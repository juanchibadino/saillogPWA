"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { PublicConfigOptionsResponse } from "@/lib/catalog/public-options";
import {
  COLOR_GROUP_LABELS,
  STYLE_LABELS,
  WOOD_LABELS,
  type ColorGroup,
  type StyleType,
  type WoodType,
} from "@/lib/catalog/taxonomy";
import {
  deriveSimpleBastidorSnapshot,
} from "@/lib/pricing/frame-geometry";
import type { AssemblyMode, BastidorVariant } from "@/types/domain";

type FrameOption = PublicConfigOptionsResponse["frames"][number];
type GlassChoice = "normal" | "reflex";

type FormItem = {
  widthCm: number;
  heightCm: number;
  quantity: number;
  woodType: string;
  styleType: "" | StyleType;
  colorGroup: ColorGroup;
  finishColorHex: string | null;
  finishColorName: string;
  faceMm: number;
  depthMm: number;
  assemblyMode: AssemblyMode;
  bastidorVariant: BastidorVariant;
  bastidorLightCm: number | null;
  bastidorSecondaryFrameId: string | null;
  bastidorSupportMm: number | null;
  bastidorLomoMm: number | null;
  bastidorDepthMm: number | null;
  hasGlass: boolean;
  hasMatboard: boolean;
  matboardBorderCm: number | null;
  glassTypeId: string | null;
  matboardTypeId: string | null;
  uploadedImageUrl: string;
};

type LeadResponse = {
  leadId: string;
  preliminaryTotal: number;
  whatsappUrl: string | null;
  orientativeNotice: string;
};

type ApiErrorResponse = {
  error: string;
  details?: unknown;
};

type SizeOption = {
  faceMm: number;
  depthMm: number;
  value: string;
  label: string;
};

const PUBLIC_REQUEST_TIMEOUT_MS = 12000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_LABELS: Record<string, string> = {
  customerName: "Nombre",
  customerPhone: "Telefono",
  customerEmail: "Email",
  widthCm: "Ancho",
  heightCm: "Alto",
  quantity: "Cantidad",
  woodType: "Madera",
  styleType: "Estilo",
  colorGroup: "Terminacion",
  finishColorHex: "Color HEX",
  finishColorName: "Nombre de color",
  faceMm: "Frente (mm)",
  depthMm: "Profundidad (mm)",
  assemblyMode: "Modo de armado",
  bastidorVariant: "Tipo bastidor",
  bastidorLightCm: "Luz (cm)",
  bastidorSecondaryFrameId: "Segunda varilla",
  bastidorSupportMm: "Soporte real (mm)",
  bastidorLomoMm: "Lomo (mm)",
  bastidorDepthMm: "Profundidad bastidor (mm)",
  hasGlass: "Vidrio",
  hasMatboard: "Paspartu",
  matboardBorderCm: "Borde paspartu (cm)",
  glassTypeId: "Tipo de vidrio",
  matboardTypeId: "Tipo de paspartu",
  items: "Items",
};

const STEP_DEFS = [
  { id: 1, title: "Datos de contacto" },
  { id: 2, title: "Tamano de lamina" },
  { id: 3, title: "Marcos" },
  { id: 4, title: "Paspartu y vidrio" },
  { id: 5, title: "Upload (deshabilitado)" },
  { id: 6, title: "Resumen" },
] as const;

const MATBOARD_NONE_VALUE = "none";

function titleize(value: string): string {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function styleLabel(value: string): string {
  return STYLE_LABELS[value as StyleType] ?? titleize(value);
}

function woodLabel(value: string): string {
  return WOOD_LABELS[value as WoodType] ?? titleize(value);
}

function bastidorVariantLabel(value: BastidorVariant): string {
  return value === "double_profile" ? "Dos varillas" : "Simple";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveGlassTypeIds(glassTypes: PublicConfigOptionsResponse["glassTypes"]) {
  let normalId: string | null = null;
  let reflexId: string | null = null;

  for (const glass of glassTypes) {
    const name = normalizeText(glass.name);

    if (!reflexId && name.includes("reflex")) {
      reflexId = glass.id;
    }

    if (
      !normalId &&
      (name.includes("normal") || name.includes("float") || name.includes("comun"))
    ) {
      normalId = glass.id;
    }
  }

  return { normalId, reflexId };
}

function sizeValue(faceMm: number, depthMm: number) {
  return `${faceMm}::${depthMm}`;
}

function parseSizeValue(raw: string) {
  const [faceRaw, depthRaw] = raw.split("::");
  return {
    faceMm: Number(faceRaw),
    depthMm: Number(depthRaw),
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatValidationDetails(details: unknown): string | null {
  if (!isRecord(details)) {
    return null;
  }

  const messages: string[] = [];
  const formErrors = details.formErrors;
  const fieldErrors = details.fieldErrors;

  if (Array.isArray(formErrors)) {
    for (const error of formErrors) {
      if (typeof error === "string" && error.trim()) {
        messages.push(error.trim());
      }
    }
  }

  if (isRecord(fieldErrors)) {
    for (const [field, errors] of Object.entries(fieldErrors)) {
      if (!Array.isArray(errors)) {
        continue;
      }

      const firstError = errors.find((error): error is string =>
        typeof error === "string" && error.trim().length > 0,
      );

      if (!firstError) {
        continue;
      }

      const label = FIELD_LABELS[field] ?? field;
      messages.push(`${label}: ${firstError}`);
    }
  }

  if (messages.length === 0) {
    return null;
  }

  return messages.join(" | ");
}

function uniqueSorted<T extends string | number>(values: T[]): T[] {
  const deduped = Array.from(new Set(values));

  return deduped.sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }

    return String(a).localeCompare(String(b), "es");
  });
}

function buildSizeOptions(frames: FrameOption[]): SizeOption[] {
  const map = new Map<string, SizeOption>();

  for (const frame of frames) {
    const value = sizeValue(frame.faceMm, frame.depthMm);

    if (!map.has(value)) {
      map.set(value, {
        faceMm: frame.faceMm,
        depthMm: frame.depthMm,
        value,
        label: `${frame.faceMm} x ${frame.depthMm} mm`,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => a.faceMm - b.faceMm || a.depthMm - b.depthMm,
  );
}

function framesForAssemblyMode(frames: FrameOption[], assemblyMode: AssemblyMode) {
  return assemblyMode === "bastidor"
    ? frames.filter((frame) => frame.supportsBastidor)
    : frames;
}

function getStep3Options(frames: FrameOption[], item: FormItem) {
  const availableFrames = framesForAssemblyMode(frames, item.assemblyMode);
  const styleOptions = uniqueSorted(availableFrames.map((frame) => frame.styleType));
  const selectedStyle =
    item.styleType && styleOptions.includes(item.styleType) ? item.styleType : "";
  const framesByStyle = selectedStyle
    ? availableFrames.filter((frame) => frame.styleType === selectedStyle)
    : [];

  const sizeOptions = buildSizeOptions(framesByStyle);
  const hasCurrentSize = sizeOptions.some(
    (size) => size.faceMm === item.faceMm && size.depthMm === item.depthMm,
  );
  const selectedSize = hasCurrentSize ? { faceMm: item.faceMm, depthMm: item.depthMm } : null;

  const framesBySize = selectedSize
    ? framesByStyle.filter(
        (frame) => frame.faceMm === selectedSize.faceMm && frame.depthMm === selectedSize.depthMm,
      )
    : [];

  const woodOptions = uniqueSorted(framesBySize.map((frame) => frame.woodType));
  const selectedWood = woodOptions.includes(item.woodType) ? item.woodType : "";
  const framesByWood = selectedWood
    ? framesBySize.filter((frame) => frame.woodType === selectedWood)
    : [];
  const colorOptions = uniqueSorted(framesByWood.map((frame) => frame.colorGroup));

  return {
    selectedStyle,
    selectedSize,
    selectedWood,
    styleOptions,
    sizeOptions,
    woodOptions,
    colorOptions,
  };
}

function normalizeItemSelection(item: FormItem, frames: FrameOption[]): FormItem {
  if (frames.length === 0) {
    return item;
  }

  const next = { ...item };
  const availableFrames = framesForAssemblyMode(frames, next.assemblyMode);
  const styleOptions = uniqueSorted(availableFrames.map((frame) => frame.styleType));
  if (!next.styleType) {
    next.woodType = "";
    next.faceMm = 0;
    next.depthMm = 0;
    next.colorGroup = "natural";
    next.finishColorHex = null;
    next.finishColorName = "";
    if (next.assemblyMode === "normal") {
      next.bastidorLightCm = null;
      next.bastidorSecondaryFrameId = null;
      next.bastidorSupportMm = null;
      next.bastidorLomoMm = null;
      next.bastidorDepthMm = null;
    }
    return next;
  }

  if (!styleOptions.includes(next.styleType as StyleType)) {
    next.styleType = "";
    next.woodType = "";
    next.faceMm = 0;
    next.depthMm = 0;
    next.colorGroup = "natural";
    next.finishColorHex = null;
    next.finishColorName = "";
    next.bastidorSecondaryFrameId = null;
    return next;
  }

  const framesByStyle = availableFrames.filter((frame) => frame.styleType === next.styleType);
  const sizeOptions = buildSizeOptions(framesByStyle);
  const hasSelectedSize = sizeOptions.some(
    (size) => size.faceMm === next.faceMm && size.depthMm === next.depthMm,
  );
  if (!hasSelectedSize) {
    next.woodType = "";
    next.faceMm = 0;
    next.depthMm = 0;
    next.colorGroup = "natural";
    next.finishColorHex = null;
    next.finishColorName = "";
    next.bastidorSecondaryFrameId = null;
    return next;
  }

  const framesBySize = framesByStyle.filter(
    (frame) => frame.faceMm === next.faceMm && frame.depthMm === next.depthMm,
  );
  const woodOptions = uniqueSorted(framesBySize.map((frame) => frame.woodType));
  if (!woodOptions.includes(next.woodType)) {
    next.woodType = "";
    next.colorGroup = "natural";
    next.finishColorHex = null;
    next.finishColorName = "";
    return next;
  }

  const framesByWood = framesBySize.filter((frame) => frame.woodType === next.woodType);
  const colorOptions = uniqueSorted(
    framesByWood.map((frame) => frame.colorGroup),
  );
  if (!colorOptions.includes(next.colorGroup)) {
    next.colorGroup = (colorOptions.includes("natural")
      ? "natural"
      : colorOptions[0] ?? "natural") as ColorGroup;
  }

  if (next.colorGroup !== "color") {
    next.finishColorHex = null;
    next.finishColorName = "";
  } else if (!next.finishColorHex) {
    next.finishColorHex = "#000000";
  }

  if (next.assemblyMode === "normal") {
    next.bastidorLightCm = null;
    next.bastidorSecondaryFrameId = null;
    next.bastidorSupportMm = null;
    next.bastidorLomoMm = null;
    next.bastidorDepthMm = null;
  } else {
    next.bastidorSupportMm = null;
    next.bastidorLomoMm = null;
    next.bastidorDepthMm = null;

    if (next.bastidorVariant === "simple") {
      next.bastidorSecondaryFrameId = null;
    }
  }

  return next;
}

function buildInitialItem(
  options: PublicConfigOptionsResponse,
  defaultGlassTypeId: string | null,
): FormItem {
  return {
    widthCm: 40,
    heightCm: 30,
    quantity: 1,
    woodType: "",
    styleType: "",
    colorGroup: "natural",
    finishColorHex: null,
    finishColorName: "",
    faceMm: 0,
    depthMm: 0,
    assemblyMode: "normal",
    bastidorVariant: "simple",
    bastidorLightCm: null,
    bastidorSecondaryFrameId: null,
    bastidorSupportMm: null,
    bastidorLomoMm: null,
    bastidorDepthMm: null,
    hasGlass: true,
    hasMatboard: false,
    matboardBorderCm: null,
    glassTypeId: defaultGlassTypeId,
    matboardTypeId: options.matboardTypes[0]?.id ?? null,
    uploadedImageUrl: "",
  };
}

function findExactFrame(frames: FrameOption[], item: FormItem): FrameOption | null {
  return (
    frames.find(
      (frame) =>
        frame.woodType === item.woodType &&
        frame.styleType === item.styleType &&
        frame.colorGroup === item.colorGroup &&
        frame.faceMm === item.faceMm &&
        frame.depthMm === item.depthMm,
    ) ?? null
  );
}

function findFrameById(frames: FrameOption[], id: string | null): FrameOption | null {
  if (!id) {
    return null;
  }

  return frames.find((frame) => frame.id === id) ?? null;
}

function getPrimaryBastidorSnapshot(item: FormItem, frame: FrameOption | null) {
  if (item.assemblyMode !== "bastidor" || !frame) {
    return null;
  }

  return deriveSimpleBastidorSnapshot(
    {
      id: frame.id,
      faceMm: frame.faceMm,
      depthMm: frame.depthMm,
      lomoMm: frame.lomoMm,
    },
    item.bastidorLightCm ?? 0,
  );
}

function getGlassChoice(
  item: FormItem,
  glassTypeIds: { normalId: string | null; reflexId: string | null },
): GlassChoice | null {
  if (!item.glassTypeId) {
    return null;
  }

  if (glassTypeIds.normalId && item.glassTypeId === glassTypeIds.normalId) {
    return "normal";
  }

  if (glassTypeIds.reflexId && item.glassTypeId === glassTypeIds.reflexId) {
    return "reflex";
  }

  return null;
}

export function ConfiguratorPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<PublicConfigOptionsResponse | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [items, setItems] = useState<FormItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const [result, setResult] = useState<LeadResponse | null>(null);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, PUBLIC_REQUEST_TIMEOUT_MS);

    async function loadOptions() {
      try {
        setLoading(true);
        const response = await fetch("/api/public/config-options", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("No se pudieron cargar las opciones del configurador.");
        }

        const payload = (await response.json()) as PublicConfigOptionsResponse;
        const glassTypeIds = resolveGlassTypeIds(payload.glassTypes);

        if (ignore) {
          return;
        }

        setOptions(payload);
        setItems([buildInitialItem(payload, glassTypeIds.normalId)]);
        setActiveItemIndex(0);
      } catch (loadError) {
        if (ignore) {
          return;
        }

        setError(
          isAbortError(loadError)
            ? "Tiempo de espera agotado al cargar opciones. Revisa la conexion con Supabase."
            : loadError instanceof Error
              ? loadError.message
              : "Error inesperado.",
        );
      } finally {
        window.clearTimeout(timeoutId);

        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadOptions();

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setActiveItemIndex(0);
      return;
    }

    if (activeItemIndex > items.length - 1) {
      setActiveItemIndex(items.length - 1);
    }
  }, [activeItemIndex, items.length]);

  const glassTypeIds = useMemo(
    () => resolveGlassTypeIds(options?.glassTypes ?? []),
    [options?.glassTypes],
  );
  const hasRequiredGlassTypes = Boolean(glassTypeIds.normalId && glassTypeIds.reflexId);

  const activeItem = items[activeItemIndex] ?? null;
  const activeFrame = activeItem && options ? findExactFrame(options.frames, activeItem) : null;
  const activeSecondaryFrame =
    activeItem && options
      ? findFrameById(options.frames, activeItem.bastidorSecondaryFrameId)
      : null;
  const primaryBastidorSnapshot =
    activeItem && activeFrame ? getPrimaryBastidorSnapshot(activeItem, activeFrame) : null;
  const step3Options =
    activeItem && options ? getStep3Options(options.frames, activeItem) : null;
  const activeGlassChoice = activeItem ? getGlassChoice(activeItem, glassTypeIds) : null;
  const hasStep3Style = Boolean(activeItem?.styleType);
  const hasStep3Size = Boolean(activeItem && activeItem.faceMm > 0 && activeItem.depthMm > 0);
  const hasStep3Wood = Boolean(activeItem?.woodType);

  const frameLabelById = useMemo(
    () => Object.fromEntries((options?.frames ?? []).map((frame) => [frame.id, frame.label])),
    [options],
  );
  const matboardTypeNameById = useMemo(
    () =>
      Object.fromEntries((options?.matboardTypes ?? []).map((matboard) => [matboard.id, matboard.name])),
    [options],
  );
  const hasBastidorFrames = useMemo(
    () => (options?.frames ?? []).some((frame) => frame.supportsBastidor),
    [options],
  );

  function updateItem(index: number, patch: Partial<FormItem>) {
    setItems((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item;
        }

        const merged = { ...item, ...patch };
        const frames = options?.frames ?? [];

        return normalizeItemSelection(merged, frames);
      }),
    );
  }

  function addItem() {
    if (!options) {
      return;
    }

    const next = buildInitialItem(options, glassTypeIds.normalId);
    setItems((current) => [...current, next]);
    setActiveItemIndex(items.length);
    setCurrentStep(2);
    setError(null);
    setResult(null);
  }

  function removeItem(index: number) {
    if (items.length <= 1) {
      return;
    }

    setItems((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setActiveItemIndex((current) => {
      if (index < current) {
        return current - 1;
      }

      if (index === current) {
        return Math.max(current - 1, 0);
      }

      return current;
    });
    setError(null);
  }

  function resetWizard() {
    if (!options) {
      return;
    }

    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setItems([buildInitialItem(options, glassTypeIds.normalId)]);
    setActiveItemIndex(0);
    setCurrentStep(1);
    setResult(null);
    setError(null);
  }

  function goToItem(index: number) {
    setActiveItemIndex(index);
    setCurrentStep(2);
    setError(null);
  }

  function validateStep1() {
    const normalizedName = customerName.trim();
    const normalizedPhone = customerPhone.trim();
    const normalizedEmail = customerEmail.trim();

    if (!normalizedName || !normalizedPhone) {
      return "Completa nombre y telefono para continuar.";
    }

    if (normalizedName.length < 2) {
      return "El nombre debe tener al menos 2 caracteres.";
    }

    if (normalizedPhone.length < 6) {
      return "El telefono debe tener al menos 6 caracteres.";
    }

    if (normalizedEmail && !EMAIL_REGEX.test(normalizedEmail)) {
      return "Ingresa un email valido o deja el campo vacio.";
    }

    return null;
  }

  function validateStep2(item: FormItem | null) {
    if (!item) {
      return "No hay cuadro activo para configurar.";
    }

    if (!Number.isFinite(item.widthCm) || !Number.isFinite(item.heightCm)) {
      return "Ancho y alto deben ser numeros validos.";
    }

    if (!Number.isFinite(item.quantity) || !Number.isInteger(item.quantity)) {
      return "La cantidad debe ser un numero entero.";
    }

    if (item.widthCm <= 0 || item.heightCm <= 0 || item.quantity <= 0) {
      return "Carga ancho, alto y cantidad mayores a 0.";
    }

    if (item.quantity > 100) {
      return "La cantidad maxima por item es 100.";
    }

    return null;
  }

  function validateStep3(item: FormItem | null) {
    if (!item || !options) {
      return "No hay cuadro activo para configurar.";
    }

    if (!item.styleType) {
      return "Selecciona un estilo.";
    }

    if (item.faceMm <= 0 || item.depthMm <= 0) {
      return "Selecciona un tamano de varilla.";
    }

    if (!item.woodType) {
      return "Selecciona una madera.";
    }

    if (item.colorGroup === "color" && !item.finishColorHex) {
      return "Selecciona un color HEX para la terminacion libre.";
    }

    if (!findExactFrame(options.frames, item)) {
      return "La combinacion de marco elegida no es valida.";
    }

    if (item.assemblyMode === "bastidor") {
      if (item.bastidorLightCm === null || item.bastidorLightCm <= 0) {
        return "Define la luz del bastidor en cm.";
      }

      const primaryFrame = findExactFrame(options.frames, item);

      if (!primaryFrame?.supportsBastidor) {
        return "La varilla elegida no esta habilitada para bastidor.";
      }

      if (!getPrimaryBastidorSnapshot(item, primaryFrame)) {
        return "La varilla elegida no tiene lomo configurado para bastidor.";
      }

      if (item.bastidorVariant === "simple") {
        return null;
      }

      if (item.bastidorVariant === "double_profile") {
        const secondaryFrame = findFrameById(options.frames, item.bastidorSecondaryFrameId);

        if (!secondaryFrame?.supportsBastidor) {
          return "Selecciona una segunda varilla apta para bastidor.";
        }
      }
    }

    return null;
  }

  function validateStep4(item: FormItem | null) {
    if (!item) {
      return "No hay cuadro activo para configurar.";
    }

    if (!hasRequiredGlassTypes) {
      return "Catalogo de vidrio incompleto: faltan tipos Normal/Reflex.";
    }

    if (item.hasGlass) {
      const validGlassChoice = getGlassChoice(item, glassTypeIds);

      if (!validGlassChoice) {
        return "Selecciona un tipo de vidrio (Normal o Reflex).";
      }
    }

    if (item.hasMatboard && (!item.matboardBorderCm || item.matboardBorderCm <= 0)) {
      return "Define un borde de paspartu mayor a 0.";
    }

    return null;
  }

  function validateCurrentStep() {
    if (currentStep === 1) {
      return validateStep1();
    }

    if (currentStep === 2) {
      return validateStep2(activeItem);
    }

    if (currentStep === 3) {
      return validateStep3(activeItem);
    }

    if (currentStep === 4) {
      return validateStep4(activeItem);
    }

    return null;
  }

  function goNextStep() {
    const validationError = validateCurrentStep();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setCurrentStep((current) => Math.min(6, current + 1));
  }

  function goPreviousStep() {
    setError(null);
    setCurrentStep((current) => Math.max(1, current - 1));
  }

  function buildPayloadItems() {
    if (!options) {
      throw new Error("No hay opciones de catalogo cargadas.");
    }

    return items.map((item, index) => {
      const step2Error = validateStep2(item);
      if (step2Error) {
        throw new Error(`Cuadro #${index + 1}: ${step2Error}`);
      }

      const frame = findExactFrame(options.frames, item);
      if (!frame) {
        throw new Error(`Cuadro #${index + 1}: combinacion de marco invalida.`);
      }

      const step4Error = validateStep4(item);
      if (step4Error) {
        throw new Error(`Cuadro #${index + 1}: ${step4Error}`);
      }

      return {
        widthCm: item.widthCm,
        heightCm: item.heightCm,
        quantity: item.quantity,
        woodType: frame.woodType,
        styleType: frame.styleType,
        colorGroup: frame.colorGroup,
        finishColorHex: frame.colorGroup === "color" ? item.finishColorHex : null,
        finishColorName: frame.colorGroup === "color" ? item.finishColorName.trim() || null : null,
        faceMm: frame.faceMm,
        depthMm: frame.depthMm,
        assemblyMode: item.assemblyMode,
        bastidorVariant: item.assemblyMode === "bastidor" ? item.bastidorVariant : null,
        bastidorLightCm: item.assemblyMode === "bastidor" ? item.bastidorLightCm : null,
        bastidorSecondaryFrameId:
          item.assemblyMode === "bastidor" && item.bastidorVariant === "double_profile"
            ? item.bastidorSecondaryFrameId
            : null,
        bastidorSupportMm: null,
        bastidorLomoMm: null,
        bastidorDepthMm: null,
        hasGlass: item.hasGlass,
        hasMatboard: item.hasMatboard,
        matboardBorderCm: item.hasMatboard ? item.matboardBorderCm : null,
        glassTypeId: item.hasGlass ? item.glassTypeId : null,
        matboardTypeId: item.hasMatboard ? item.matboardTypeId : null,
        uploadedImageUrl: null,
      };
    });
  }

  async function submit() {
    if (!options) {
      return;
    }

    const contactError = validateStep1();
    if (contactError) {
      setError(contactError);
      return;
    }

    if (items.length === 0) {
      setError("Agrega al menos un cuadro.");
      return;
    }

    let payloadItems: ReturnType<typeof buildPayloadItems>;

    try {
      payloadItems = buildPayloadItems();
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "Error inesperado.");
      return;
    }

    setError(null);
    setResult(null);
    setSubmitting(true);
    const normalizedCustomerName = customerName.trim();
    const normalizedCustomerPhone = customerPhone.trim();
    const normalizedCustomerEmail = customerEmail.trim();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, PUBLIC_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          customerName: normalizedCustomerName,
          customerPhone: normalizedCustomerPhone,
          customerEmail: normalizedCustomerEmail,
          items: payloadItems,
        }),
      });

      const payload = (await response.json()) as LeadResponse | ApiErrorResponse;

      if (!response.ok) {
        const message =
          "error" in payload && payload.error === "Validation failed."
            ? (() => {
                const detailed = formatValidationDetails(payload.details);
                return detailed ? `Validation failed. ${detailed}` : payload.error;
              })()
            : "error" in payload
              ? payload.error
              : "No se pudo guardar el lead.";
        throw new Error(message);
      }

      setResult(payload as LeadResponse);
      setCurrentStep(6);
    } catch (submitError) {
      setError(
        isAbortError(submitError)
          ? "Tiempo de espera agotado al guardar el lead. Revisa la conexion con Supabase."
          : submitError instanceof Error
            ? submitError.message
            : "Error inesperado.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-neutral-500">Cargando configurador...</p>;
  }

  if (error && !options) {
    return <p className="p-6 text-sm text-red-600">{error}</p>;
  }

  if (!options || options.frames.length === 0) {
    return (
      <p className="p-6 text-sm text-neutral-500">
        No hay opciones publicas cargadas. Publica items desde el catalogo admin.
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100/70">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Configurador</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Arma tus cuadros</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Completa el flujo por pasos para generar el lead de presupuesto.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Pasos</CardTitle>
              <CardDescription>Completa el flujo de arriba hacia abajo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {STEP_DEFS.map((step) => {
                const isCurrent = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                      isCurrent
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : isCompleted
                          ? "border-emerald-200 bg-emerald-100/50 text-emerald-800"
                          : "border-[var(--border)] text-muted-foreground"
                    }`}
                  >
                    <span className="inline-flex size-6 items-center justify-center rounded-full border text-xs font-medium">
                      {step.id}
                    </span>
                    <span>{step.title}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {currentStep >= 2 && currentStep <= 5 && activeItem ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cuadro Activo</CardTitle>
                <CardDescription>
                  #{activeItemIndex + 1} de {items.length}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-neutral-600">
                <p>{activeFrame ? frameLabelById[activeFrame.id] : "Combinacion invalida"}</p>
                <p>
                  Lamina {activeItem.widthCm} x {activeItem.heightCm} cm | cant.{" "}
                  {activeItem.quantity}
                </p>
                <p>
                  Armado: {activeItem.assemblyMode === "bastidor"
                    ? activeItem.bastidorVariant === "double_profile"
                      ? "Bastidor dos varillas"
                      : "Bastidor simple"
                    : "Normal"}
                </p>
                {activeItem.hasMatboard && activeItem.matboardBorderCm ? (
                  <p>Borde paspartu: {activeItem.matboardBorderCm.toFixed(1)} cm</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </aside>

        <section className="space-y-6 lg:col-span-2">

      {currentStep === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Paso 1 - Datos de contacto</CardTitle>
            <CardDescription>Datos del cliente para seguimiento comercial.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Nombre</span>
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Telefono</span>
              <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Email</span>
              <Input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
            </label>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 2 && activeItem ? (
        <Card>
          <CardHeader>
            <CardTitle>Paso 2 - Tamano de la lamina</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Ancho de lamina (cm)</span>
              <Input
                type="number"
                min={1}
                value={activeItem.widthCm}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  updateItem(activeItemIndex, {
                    widthCm: Number.isFinite(parsed) ? Math.max(1, parsed) : 1,
                  });
                }}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Alto de lamina (cm)</span>
              <Input
                type="number"
                min={1}
                value={activeItem.heightCm}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  updateItem(activeItemIndex, {
                    heightCm: Number.isFinite(parsed) ? Math.max(1, parsed) : 1,
                  });
                }}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Cantidad</span>
              <Input
                type="number"
                min={1}
                max={100}
                value={activeItem.quantity}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  updateItem(activeItemIndex, {
                    quantity:
                      Number.isFinite(parsed) && Number.isInteger(parsed)
                        ? Math.min(100, Math.max(1, parsed))
                        : 1,
                  });
                }}
              />
            </label>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 3 && activeItem && step3Options ? (
        <Card>
          <CardHeader>
            <CardTitle>Paso 3 - Marcos</CardTitle>
            <CardDescription>Armado, estilo, tamaño, madera y terminación.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="w-full space-y-1 text-sm">
              <span className="text-neutral-600">Modo de armado</span>
              <Select
                value={activeItem.assemblyMode}
                onValueChange={(value) => {
                  if (value === null) {
                    return;
                  }

                  updateItem(activeItemIndex, {
                    assemblyMode: value as AssemblyMode,
                    styleType: activeItem.styleType,
                    woodType: activeItem.woodType,
                    bastidorVariant: value === "bastidor" ? activeItem.bastidorVariant : "simple",
                    bastidorLightCm: value === "bastidor" ? activeItem.bastidorLightCm ?? 1 : null,
                    bastidorSecondaryFrameId: null,
                    bastidorSupportMm: null,
                    bastidorLomoMm: null,
                    bastidorDepthMm: null,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Modo de armado">
                    {activeItem.assemblyMode === "bastidor" ? "Bastidor" : "Normal"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  {hasBastidorFrames ? <SelectItem value="bastidor">Bastidor</SelectItem> : null}
                </SelectContent>
              </Select>
            </label>

            <label className="w-full space-y-1 text-sm">
              <span className="text-neutral-600">Estilo</span>
              <Select
                value={activeItem.styleType || null}
                onValueChange={(value) => {
                  if (value === null) {
                    return;
                  }

                  updateItem(activeItemIndex, {
                    styleType: value as FormItem["styleType"],
                    woodType: "",
                    faceMm: 0,
                    depthMm: 0,
                    colorGroup: "natural",
                    finishColorHex: null,
                    finishColorName: "",
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Estilo" />
                </SelectTrigger>
                <SelectContent>
                  {step3Options.styleOptions.map((style) => (
                    <SelectItem key={style} value={style}>
                      {styleLabel(style)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="w-full space-y-1 text-sm">
              <span className="text-neutral-600">Tamaño (varilla)</span>
              <Select
                value={hasStep3Size ? sizeValue(activeItem.faceMm, activeItem.depthMm) : null}
                disabled={!hasStep3Style}
                onValueChange={(value) => {
                  if (value === null) {
                    return;
                  }

                  const parsed = parseSizeValue(value);
                  updateItem(activeItemIndex, {
                    faceMm: parsed.faceMm,
                    depthMm: parsed.depthMm,
                    woodType: "",
                    colorGroup: "natural",
                    finishColorHex: null,
                    finishColorName: "",
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tamano" />
                </SelectTrigger>
                <SelectContent>
                  {step3Options.sizeOptions.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hasStep3Style ? (
                <p className="text-xs text-muted-foreground">Selecciona primero un estilo.</p>
              ) : null}
            </label>

            <label className="w-full space-y-1 text-sm">
              <span className="text-neutral-600">Tipo de madera</span>
              <Select
                value={activeItem.woodType || null}
                disabled={!hasStep3Size}
                onValueChange={(value) => {
                  if (value === null) {
                    return;
                  }

                  updateItem(activeItemIndex, {
                    woodType: value,
                    colorGroup: "natural",
                    finishColorHex: null,
                    finishColorName: "",
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Madera" />
                </SelectTrigger>
                <SelectContent>
                  {step3Options.woodOptions.map((wood) => (
                    <SelectItem key={wood} value={wood}>
                      {woodLabel(wood)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hasStep3Size ? (
                <p className="text-xs text-muted-foreground">Selecciona primero un tamaño.</p>
              ) : null}
            </label>

            <label className="w-full space-y-1 text-sm">
              <span className="text-neutral-600">Terminacion</span>
              <Select
                value={hasStep3Wood ? activeItem.colorGroup : null}
                disabled={!hasStep3Wood || step3Options.colorOptions.length === 0}
                onValueChange={(value) => {
                  if (value === null) {
                    return;
                  }

                  updateItem(activeItemIndex, {
                    colorGroup: value as ColorGroup,
                    finishColorHex: value === "color" ? activeItem.finishColorHex ?? "#000000" : null,
                    finishColorName: value === "color" ? activeItem.finishColorName : "",
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Terminacion" />
                </SelectTrigger>
                <SelectContent>
                  {step3Options.colorOptions.map((color) => (
                    <SelectItem key={color} value={color}>
                      {COLOR_GROUP_LABELS[color]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hasStep3Wood ? (
                <p className="text-xs text-muted-foreground">
                  Selecciona primero una madera.
                </p>
              ) : null}
            </label>

            {hasStep3Wood && activeItem.colorGroup === "color" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="w-full space-y-1 text-sm">
                  <span className="text-neutral-600">Color HEX</span>
                  <Input
                    type="color"
                    value={activeItem.finishColorHex ?? "#000000"}
                    onChange={(event) =>
                      updateItem(activeItemIndex, {
                        finishColorHex: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="w-full space-y-1 text-sm">
                  <span className="text-neutral-600">Nombre de color (opcional)</span>
                  <Input
                    value={activeItem.finishColorName}
                    onChange={(event) =>
                      updateItem(activeItemIndex, {
                        finishColorName: event.target.value,
                      })
                    }
                    placeholder="Ej: Verde ingles"
                  />
                </label>
              </div>
            ) : null}

            {activeItem.assemblyMode === "bastidor" ? (
              <section className="space-y-4 rounded-lg border border-[var(--border)] p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="w-full space-y-1 text-sm">
                    <span className="text-neutral-600">Tipo de bastidor</span>
                    <Select
                      value={activeItem.bastidorVariant}
                      onValueChange={(value) => {
                        if (value === null) {
                          return;
                        }

                        updateItem(activeItemIndex, {
                          bastidorVariant: value as BastidorVariant,
                          bastidorSecondaryFrameId: null,
                          bastidorSupportMm: null,
                          bastidorLomoMm: null,
                          bastidorDepthMm: null,
                        });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Tipo de bastidor">
                          {bastidorVariantLabel(activeItem.bastidorVariant)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simple</SelectItem>
                        <SelectItem value="double_profile">Dos varillas</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="w-full space-y-1 text-sm">
                    <span className="text-neutral-600">Luz (cm)</span>
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={activeItem.bastidorLightCm ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const parsed = Number(raw);
                        updateItem(activeItemIndex, {
                          bastidorLightCm:
                            raw.trim() === "" || Number.isNaN(parsed)
                              ? null
                              : Math.max(0.1, parsed),
                        });
                      }}
                    />
                  </label>
                </div>

                {activeItem.bastidorVariant === "simple" ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-1 text-sm">
                      <span className="text-neutral-600">Lomo</span>
                      <Input
                        value={
                          primaryBastidorSnapshot
                            ? `${primaryBastidorSnapshot.lomoMm.toFixed(1)} mm`
                            : "-"
                        }
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-neutral-600">Soporte real</span>
                      <Input
                        value={
                          primaryBastidorSnapshot
                            ? `${primaryBastidorSnapshot.supportMm.toFixed(1)} mm`
                            : "-"
                        }
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-neutral-600">Profundidad</span>
                      <Input
                        value={
                          primaryBastidorSnapshot
                            ? `${primaryBastidorSnapshot.depthMm.toFixed(1)} mm`
                            : "-"
                        }
                        readOnly
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <label className="w-full space-y-1 text-sm">
                      <span className="text-neutral-600">Segunda varilla</span>
                      <Select
                        value={activeItem.bastidorSecondaryFrameId ?? null}
                        onValueChange={(value) =>
                          updateItem(activeItemIndex, {
                            bastidorSecondaryFrameId: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Segunda varilla">
                            {activeSecondaryFrame?.label ?? "Segunda varilla"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(options.frames ?? [])
                            .filter((frame) => frame.supportsBastidor)
                            .map((frame) => (
                              <SelectItem key={frame.id} value={frame.id}>
                                {frame.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </>
                )}
                {activeItem.bastidorVariant === "double_profile" && activeSecondaryFrame ? (
                  <p className="text-xs text-muted-foreground">
                    Segunda varilla: {activeSecondaryFrame.label}
                  </p>
                ) : null}
              </section>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 4 && activeItem ? (
        <Card>
          <CardHeader>
            <CardTitle>Paso 4 - Paspartu y Vidrio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!hasRequiredGlassTypes ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Catálogo de vidrio incompleto: deben existir tipos Normal y Reflex 2mm.
              </p>
            ) : null}

            <section className="space-y-4 rounded-lg border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Paspartu</p>
                  <p className="text-xs text-neutral-700">
                    Activalo para agregar borde alrededor de la lamina o bastidor.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                  <Switch
                    checked={activeItem.hasMatboard}
                    onCheckedChange={(checked) => {
                      const enabled = checked;
                      updateItem(activeItemIndex, {
                        hasMatboard: enabled,
                        matboardBorderCm: enabled ? activeItem.matboardBorderCm ?? 5 : null,
                        matboardTypeId: enabled
                          ? activeItem.matboardTypeId ?? options.matboardTypes[0]?.id ?? null
                          : null,
                      });
                    }}
                  />
                  Tiene paspartu
                </label>
              </div>

              {activeItem.hasMatboard ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="w-full space-y-1 text-sm">
                      <span className="text-neutral-600">Tipo de paspartu</span>
                      <Select
                        value={activeItem.matboardTypeId ?? MATBOARD_NONE_VALUE}
                        onValueChange={(value) => {
                          if (value === null) {
                            return;
                          }

                          updateItem(activeItemIndex, {
                            matboardTypeId: value === MATBOARD_NONE_VALUE ? null : value,
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value) => {
                              const selected = typeof value === "string" ? value : null;
                              if (!selected || selected === MATBOARD_NONE_VALUE) {
                                return "Sin seleccionar";
                              }

                              return matboardTypeNameById[selected] ?? "Sin seleccionar";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={MATBOARD_NONE_VALUE}>Sin seleccionar</SelectItem>
                          {options.matboardTypes.map((matboard) => (
                            <SelectItem key={matboard.id} value={matboard.id}>
                              {matboard.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    <label className="w-full space-y-1 text-sm">
                      <span className="text-neutral-600">Cuanto (borde en cm)</span>
                      <Input
                        className="w-full"
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={activeItem.matboardBorderCm ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const parsed = Number(raw);
                          updateItem(activeItemIndex, {
                            matboardBorderCm:
                              raw.trim() === "" || Number.isNaN(parsed)
                                ? null
                                : Math.max(0.1, parsed),
                          });
                        }}
                      />
                    </label>
                  </div>

                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Al agregar paspartu, el tamano final del cuadro se agrandara por encima de la
                    lamina o bastidor segun el borde elegido (se suma el borde en cada lado).
                  </p>
                </>
              ) : null}
            </section>

            <section className="space-y-4 rounded-lg border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Vidrio</p>
                  <p className="text-xs text-neutral-700">
                    Define si el cuadro lleva vidrio y el tipo de terminado.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                  <Switch
                    checked={activeItem.hasGlass}
                    onCheckedChange={(checked) => {
                      const enabled = checked;
                      updateItem(activeItemIndex, {
                        hasGlass: enabled,
                        glassTypeId: enabled ? activeItem.glassTypeId ?? glassTypeIds.normalId : null,
                      });
                    }}
                  />
                  Tiene vidrio
                </label>
              </div>

              {activeItem.hasGlass ? (
                <label className="block space-y-1 text-sm">
                  <span className="text-neutral-600">Tipo de vidrio</span>
                  <Select
                    value={activeGlassChoice ?? null}
                    disabled={!hasRequiredGlassTypes}
                    onValueChange={(value) => {
                      if (value === null) {
                        return;
                      }

                      updateItem(activeItemIndex, {
                        glassTypeId:
                          value === "reflex"
                            ? glassTypeIds.reflexId ?? null
                            : glassTypeIds.normalId ?? null,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tipo de vidrio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal 2mm</SelectItem>
                      <SelectItem value="reflex">Reflex 2mm</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
            </section>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 5 ? (
        <Card>
          <CardHeader>
            <CardTitle>Paso 5 - Upload de lamina digital (deshabilitado)</CardTitle>
            <CardDescription>
              Este modulo queda preparado para una siguiente iteracion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" disabled />
            <p className="text-sm text-muted-foreground">
              Proximamente se habilitara la subida JPG/PNG y generacion de render.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 6 ? (
        <Card>
          <CardHeader>
            <CardTitle>Paso 6 - Resumen</CardTitle>
            <CardDescription>Revisa toda la configuracion antes de pedir presupuesto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md border border-[var(--border)] p-3 text-sm">
              <p className="font-medium">Contacto</p>
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-neutral-700">Nombre:</span>
                  <Badge variant="outline">{customerName || "-"}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-neutral-700">Telefono:</span>
                  <Badge variant="outline">{customerPhone || "-"}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-neutral-700">Email:</span>
                  <Badge variant="outline">{customerEmail || "-"}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const frame = findExactFrame(options.frames, item);
                const secondaryFrame = findFrameById(
                  options.frames,
                  item.bastidorSecondaryFrameId,
                );
                const bastidorSnapshot = getPrimaryBastidorSnapshot(item, frame);
                const glassChoice = getGlassChoice(item, glassTypeIds);
                const glassLabel = item.hasGlass
                  ? glassChoice === "normal"
                    ? "Normal 2mm"
                    : glassChoice === "reflex"
                      ? "Reflex 2mm"
                      : "Sin tipo"
                  : "No";
                const matboardLabel = item.hasMatboard ? "Si" : "No";
                const matboardTypeLabel = item.matboardTypeId
                  ? matboardTypeNameById[item.matboardTypeId] ?? "Sin seleccionar"
                  : "Sin seleccionar";

                return (
                  <div
                    key={`${index}-${item.woodType}-${item.faceMm}-${item.depthMm}`}
                    className="rounded-md border border-[var(--border)] p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2.5 text-sm">
                        <p className="font-medium">Cuadro #{index + 1}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-neutral-700">Lamina:</span>
                          <Badge variant="outline">
                            {item.widthCm} x {item.heightCm} cm
                          </Badge>
                          <span className="text-neutral-700">Cantidad:</span>
                          <Badge variant="outline">{item.quantity}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-neutral-700">Marco:</span>
                          <Badge variant="outline">{item.woodType ? woodLabel(item.woodType) : "-"}</Badge>
                          <Badge variant="outline">{item.styleType ? styleLabel(item.styleType) : "-"}</Badge>
                          <Badge variant="outline">
                            {item.faceMm} x {item.depthMm} mm
                          </Badge>
                          <Badge variant="outline">{COLOR_GROUP_LABELS[item.colorGroup]}</Badge>
                          {item.colorGroup === "color" && item.finishColorHex ? (
                            <Badge variant="outline">{item.finishColorHex}</Badge>
                          ) : null}
                          {item.colorGroup === "color" && item.finishColorName.trim() ? (
                            <Badge variant="outline">{item.finishColorName.trim()}</Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-neutral-700">Paspartu:</span>
                          <Badge variant="outline">{matboardLabel}</Badge>
                          {item.hasMatboard ? (
                            <>
                              <span className="text-neutral-700">Tipo:</span>
                              <Badge variant="outline">{matboardTypeLabel}</Badge>
                              <span className="text-neutral-700">Borde:</span>
                              <Badge variant="outline">
                                {item.matboardBorderCm ? `${item.matboardBorderCm.toFixed(1)} cm` : "-"}
                              </Badge>
                            </>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-neutral-700">Vidrio:</span>
                          <Badge variant="outline">{glassLabel}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-neutral-700">Perfil:</span>
                          <Badge variant="secondary">
                            {frame ? frameLabelById[frame.id] : "Combinacion de marco invalida"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-neutral-700">Armado:</span>
                          <Badge variant="outline">
                            {item.assemblyMode === "bastidor"
                              ? item.bastidorVariant === "double_profile"
                                ? "Bastidor dos varillas"
                                : "Bastidor simple"
                              : "Normal"}
                          </Badge>
                          {item.assemblyMode === "bastidor" && item.bastidorLightCm !== null ? (
                            <>
                              <span className="text-neutral-700">Luz:</span>
                              <Badge variant="outline">
                                {item.bastidorLightCm.toFixed(1)} cm
                              </Badge>
                            </>
                          ) : null}
                          {item.assemblyMode === "bastidor" ? (
                            <>
                              <span className="text-neutral-700">Lomo:</span>
                              <Badge variant="outline">
                                {bastidorSnapshot
                                  ? `${bastidorSnapshot.lomoMm.toFixed(1)} mm`
                                  : "-"}
                              </Badge>
                              <span className="text-neutral-700">Soporte:</span>
                              <Badge variant="outline">
                                {bastidorSnapshot
                                  ? `${bastidorSnapshot.supportMm.toFixed(1)} mm`
                                  : "-"}
                              </Badge>
                            </>
                          ) : null}
                        </div>
                        {item.assemblyMode === "bastidor" &&
                        item.bastidorVariant === "double_profile" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-neutral-700">Segunda varilla:</span>
                            <Badge variant="secondary">
                              {secondaryFrame
                                ? frameLabelById[secondaryFrame.id]
                                : "Sin seleccionar"}
                            </Badge>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => goToItem(index)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => removeItem(index)}
                          disabled={items.length <= 1}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" size="sm" variant="outline" onClick={() => setCurrentStep(5)}>
              Volver
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                Agregar otro cuadro
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={resetWizard}>
                Borrar y volver
              </Button>
              <Button type="button" size="sm" onClick={submit} disabled={submitting}>
                {submitting ? "Guardando..." : "Pedir presupuesto"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {currentStep < 6 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={goPreviousStep}
            disabled={currentStep === 1}
          >
            Volver
          </Button>
          <Button type="button" size="sm" onClick={goNextStep}>
            Siguiente
          </Button>
        </div>
      ) : null}

      {result ? (
        <Card className="border border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="text-emerald-900">Lead generado</CardTitle>
            <CardDescription className="text-emerald-800">ID: {result.leadId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-emerald-800">
            <p>Total preliminar: ${result.preliminaryTotal.toFixed(2)}</p>
            <p>{result.orientativeNotice}</p>
            {result.whatsappUrl ? (
              <a
                href={result.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-medium underline"
              >
                Abrir WhatsApp con mensaje precargado
              </a>
            ) : (
              <p className="text-amber-700">
                Configura `NEXT_PUBLIC_BUSINESS_WHATSAPP` para habilitar el link de WhatsApp.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
        </section>
      </div>
      </div>
    </div>
  );
}
