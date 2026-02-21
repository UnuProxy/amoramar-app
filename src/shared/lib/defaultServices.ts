import type { ServiceCategory } from '@/shared/lib/types';

export type DefaultServiceSeed = {
  serviceName: string;
  description: string;
  duration: number;
  price: number;
  category: ServiceCategory;
  offersConsultation?: boolean;
  consultationDuration?: number;
};

const seed = (
  serviceName: string,
  price: number,
  duration: number,
  category: ServiceCategory,
  description = '',
  options: Pick<DefaultServiceSeed, 'offersConsultation' | 'consultationDuration'> = {}
): DefaultServiceSeed => ({
  serviceName,
  description,
  price,
  duration,
  category,
  ...options,
});

export const DEFAULT_SERVICES: DefaultServiceSeed[] = [
  // HAIR - Haircuts & Styling
  seed('Haircut (All lengths) / Corte de Pelo (todas las longitudes)', 78, 90, 'hair-haircuts-styling', 'EN: Haircut add-on with any women service is 56 EUR. ES: Al anadir corte a servicios de mujer, el precio del corte es 56 EUR.'),
  seed('Fringe Trim / Corte de flequillo', 10, 20, 'hair-haircuts-styling'),
  seed('Blow Dry Short / Peinado Corto', 47, 60, 'hair-haircuts-styling'),
  seed('Blow Dry Medium / Peinado Medio', 57, 60, 'hair-haircuts-styling'),
  seed('Blow Dry Long / Peinado Largo', 63, 90, 'hair-haircuts-styling'),
  seed('Hair Up / Recogido', 83, 90, 'hair-haircuts-styling'),

  // HAIR - Color (includes blow dry)
  seed('Roots Re-Growth (Short) / Retoque de Raiz (Corto)', 80, 90, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Roots Re-Growth (Medium) / Retoque de Raiz (Medio)', 92, 120, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Roots Re-Growth (Long) / Retoque de Raiz (Largo)', 110, 150, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Highlift Tint (Roots) (Short) / Matiz con Mechas en Raiz (Corto)', 80, 150, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Highlift Tint (Roots) (Medium) / Matiz con Mechas en Raiz (Medio)', 97, 180, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Highlift Tint (Roots) (Long) / Matiz con Mechas en Raiz (Largo)', 130, 180, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Full Head Colour / Blended Roots (Short) / Color Completo / Raiz Difuminada (Corto)', 90, 120, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Full Head Colour / Blended Roots (Medium) / Color Completo / Raiz Difuminada (Medio)', 110, 150, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Full Head Colour / Blended Roots (Long) / Color Completo / Raiz Difuminada (Largo)', 130, 150, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Toning (Short) / Tonalizacion (Corto)', 70, 90, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Toning (Medium) / Tonalizacion (Medio)', 90, 90, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Toning (Long) / Tonalizacion (Largo)', 110, 90, 'hair-color', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),

  // HAIR - Bleach & Highlights (consultation required)
  seed('Roots Bleach (Short) / Decoloracion de Raiz (Corto)', 130, 180, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Roots Bleach (Medium) / Decoloracion de Raiz (Medio)', 160, 240, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Roots Bleach (Long) / Decoloracion de Raiz (Largo)', 190, 270, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Full Head Airtouch (Short) / Airtouch Cabeza Completa (Corto)', 210, 270, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Full Head Airtouch (Medium) / Airtouch Cabeza Completa (Medio)', 240, 300, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Full Head Airtouch (Long) / Airtouch Cabeza Completa (Largo)', 260, 330, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Highlights (Short) / Mechas (Corto)', 170, 240, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Highlights (Medium) / Mechas (Medio)', 220, 270, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Highlights (Long) / Mechas (Largo)', 250, 300, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Contouring (Short) / Contouring (Corto)', 70, 120, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Contouring (Medium) / Contouring (Medio)', 90, 120, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Contouring (Long) / Contouring (Largo)', 110, 120, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Half Head Airtouch / Highlights (All lengths) / Airtouch / Mechas Media Cabeza (todas las longitudes)', 170, 240, 'hair-bleach-highlights', 'EN: Consultation required; online booking unavailable. Includes toning, K18 and blow dry. ES: Consulta obligatoria; no disponible para reserva online. Incluye tonalizacion, K18 y peinado.', { offersConsultation: true, consultationDuration: 30 }),

  // HAIR - Treatments & Signature
  seed('Brae Express', 60, 20, 'hair-treatments-signature', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Tokio Inkarami (Ceramic) (Short) / Tokio Inkarami (Ceramic) (Corto)', 124, 120, 'hair-treatments-signature', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Tokio Inkarami (Ceramic) (Medium) / Tokio Inkarami (Ceramic) (Medio)', 155, 120, 'hair-treatments-signature', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Tokio Inkarami (Ceramic) (Long) / Tokio Inkarami (Ceramic) (Largo)', 182, 120, 'hair-treatments-signature', 'EN: Approximate price. Includes blow dry. ES: Precio aproximado. Incluye lavado y peinado.'),
  seed('Nashi Filler Therapy (Short) / Nashi Filler Therapy (Corto)', 76, 90, 'hair-treatments-signature', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Nashi Filler Therapy (Medium) / Nashi Filler Therapy (Medio)', 94, 90, 'hair-treatments-signature', 'EN: Includes blow dry. ES: Incluye lavado y peinado.'),
  seed('Nashi Filler Therapy (Long) / Nashi Filler Therapy (Largo)', 110, 90, 'hair-treatments-signature', 'EN: Approximate price. Includes blow dry. ES: Precio aproximado. Incluye lavado y peinado.'),

  // HAIR - Men
  seed("Men's Haircut / Corte de caballero", 30, 60, 'hair-men', 'EN: Hair wash and blow dry included. ES: Incluye lavado y peinado.'),
  seed('Beard Trim / Arreglo de barba', 20, 40, 'hair-men', 'EN: Hair wash and blow dry included. ES: Incluye lavado y peinado.'),
  seed('Grey Colour / Color para Canas', 63, 60, 'hair-men', 'EN: Hair wash and blow dry included. ES: Incluye lavado y peinado.'),
  seed('Waxing (1 zone) / Depilacion (1 zona)', 10, 15, 'hair-men'),

  // HAIR - Kids
  seed('Girls up to 9 y.o / Ninas (hasta 9 anos)', 25, 40, 'hair-kids'),
  seed('Girls 9-14 y.o / Ninas (9-14 anos)', 45, 60, 'hair-kids'),
  seed('Boys up to 9 y.o / Ninos (hasta 9 anos)', 20, 40, 'hair-kids'),

  // HAIR - Extensions
  seed('Extension Removal / Retirada de extensiones (per piece)', 0.5, 30, 'hair-extensions', 'EN: Consultation required if hair purchase is needed. ES: Consulta obligatoria si se requiere compra de cabello.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Capsulation / Capsulacion (per piece)', 1, 30, 'hair-extensions', 'EN: Consultation required if hair purchase is needed. ES: Consulta obligatoria si se requiere compra de cabello.', { offersConsultation: true, consultationDuration: 30 }),
  seed('Extension Application / Colocacion de extensiones (per piece)', 1, 30, 'hair-extensions', 'EN: Consultation required if hair purchase is needed. ES: Consulta obligatoria si se requiere compra de cabello.', { offersConsultation: true, consultationDuration: 30 }),

  // BEAUTY - Lamination
  seed('Lash Lamination / Laminacion de pestanas', 65, 120, 'beauty-lamination', 'EN: Lash tint included. ES: Tintura de pestanas incluida.'),
  seed('Brow Lamination / Laminacion de cejas', 55, 60, 'beauty-lamination', 'EN: Brow tint included. ES: Tintura de cejas incluida.'),
  seed('Full Package Lashes + Brows (Lamination) / Pack completo laminacion', 115, 150, 'beauty-lamination'),
  seed('Brow Lamination + Shaping / Laminacion de cejas + diseno', 45, 50, 'beauty-lamination'),
  seed('Lash Tint (standalone) / Tintura de pestanas', 15, 20, 'beauty-lamination'),

  // BEAUTY - Brows (without lamination)
  seed('Brow shaping + tint / Diseno + tintura de cejas', 45, 50, 'beauty-brow-services'),
  seed('Brow shaping / Diseno de cejas', 25, 30, 'beauty-brow-services'),
  seed('Brow tint / Tintura de cejas', 25, 40, 'beauty-brow-services'),
  seed('Upper lip waxing / Depilacion de bigote', 15, 10, 'beauty-brow-services'),
  seed('Nose waxing / Depilacion de nariz', 15, 10, 'beauty-brow-services'),
  seed('Ear waxing / Depilacion de orejas', 15, 10, 'beauty-brow-services'),

  // BEAUTY - Lash extensions full set
  seed('Classic 1:1 Full Set / Extensiones 1:1', 75, 120, 'beauty-lash-extensions-full-set'),
  seed('2D Volume Full Set / Volumen 2D', 85, 130, 'beauty-lash-extensions-full-set'),
  seed('Wet Look Volume Full Set / Volumen humedo', 90, 140, 'beauty-lash-extensions-full-set'),
  seed('3D Volume Full Set / Volumen 3D', 95, 150, 'beauty-lash-extensions-full-set'),
  seed('Mega Volume Full Set / Volumen intenso', 125, 180, 'beauty-lash-extensions-full-set'),
  seed('LED Classic Full Set / LED clasico', 100, 120, 'beauty-lash-extensions-full-set'),
  seed('LED Volume Full Set / LED volumen', 125, 150, 'beauty-lash-extensions-full-set'),

  // BEAUTY - Lash refill/infill
  seed('Classic (1:1) Refill / Relleno clasico', 65, 120, 'beauty-lash-refill-infill'),
  seed('2D Volume Refill / Relleno 2D', 70, 120, 'beauty-lash-refill-infill'),
  seed('3D Volume Refill / Relleno 3D', 75, 120, 'beauty-lash-refill-infill'),
  seed('Wet Look Volume Refill / Relleno volumen humedo', 80, 120, 'beauty-lash-refill-infill'),
  seed('Mega Volume Refill / Relleno volumen intenso', 90, 120, 'beauty-lash-refill-infill'),
  seed('LED Classic Refill / Relleno LED clasico', 90, 90, 'beauty-lash-refill-infill'),
  seed('LED Volume Refill / Relleno LED volumen', 100, 120, 'beauty-lash-refill-infill'),

  // BEAUTY - Lash removal
  seed('Lash Extension Removal / Retirada de extensiones de pestanas', 30, 30, 'beauty-lash-removal'),

  // BEAUTY - Semi-permanent makeup
  seed('Brows - Powder technique / Cejas efecto polvo', 350, 210, 'beauty-semi-permanent-makeup', 'EN: Includes 6-week touch-up in initial price. ES: Incluye retoque a 6 semanas en precio inicial.'),
  seed('Lips / Labios', 350, 240, 'beauty-semi-permanent-makeup', 'EN: Includes 6-week touch-up in initial price. ES: Incluye retoque a 6 semanas en precio inicial.'),
  seed('Eye contour (lash density line) / Contorno de ojos', 200, 120, 'beauty-semi-permanent-makeup', 'EN: Includes 6-week touch-up in initial price. ES: Incluye retoque a 6 semanas en precio inicial.'),
  seed('Classic eyeliner / shaded eyeliner / Eyeliner clasico-sombreado', 230, 210, 'beauty-semi-permanent-makeup', 'EN: Includes 6-week touch-up in initial price. ES: Incluye retoque a 6 semanas en precio inicial.'),
  seed('Touch-up (any procedure) / Retoque (cualquier procedimiento)', 200, 120, 'beauty-semi-permanent-makeup'),

  // BEAUTY - Professional makeup
  seed('Day makeup / Maquillaje de dia', 100, 90, 'beauty-professional-makeup'),
  seed('Evening makeup / Maquillaje de noche', 120, 90, 'beauty-professional-makeup'),
  seed('Bridal makeup (with trial) / Maquillaje novia (con prueba)', 350, 120, 'beauty-professional-makeup'),
  seed('Bridal makeup (without trial) / Maquillaje novia (sin prueba)', 250, 120, 'beauty-professional-makeup'),

  // MANICURE
  seed('Semi-permanent gel polish / Esmaltado semipermanente', 55, 90, 'manicure', 'EN: Includes manicure and previous material removal for gel/refill/extensions. ES: Incluye manicura y retirada de material previo para gel/relleno/extensiones.'),
  seed('Gel refill (Length 1-2) / Relleno con gel longitud 1-2', 55, 100, 'manicure', 'EN: French and basic design (1-2 nails) included. ES: French y diseno basico (1-2 unas) incluido.'),
  seed('Gel refill (Length 3-4) / Relleno con gel longitud 3-4', 60, 120, 'manicure', 'EN: French and basic design (1-2 nails) included. ES: French y diseno basico (1-2 unas) incluido.'),
  seed('Extensions (Length 1-2) / Extensiones longitud 1-2', 65, 120, 'manicure', 'EN: French and basic design (1-2 nails) included. ES: French y diseno basico (1-2 unas) incluido.'),
  seed('Extensions (Length 3-4) / Extensiones longitud 3-4', 80, 150, 'manicure', 'EN: French and basic design (1-2 nails) included. ES: French y diseno basico (1-2 unas) incluido.'),
  seed('Extensions (Length 5-7) / Extensiones longitud 5-7', 100, 210, 'manicure', 'EN: French and basic design (1-2 nails) included. ES: French y diseno basico (1-2 unas) incluido.'),
  seed('French Glass / French Interior', 120, 240, 'manicure'),
  seed('Hygienic manicure / Manicura higienica', 25, 30, 'manicure'),
  seed('Hygienic manicure + classic polish / Manicura higienica + esmalte clasico', 35, 40, 'manicure'),
  seed('Gel removal (standalone) / Retirada de gel (servicio independiente)', 10, 10, 'manicure'),

  // MANICURE & PEDICURE - COMBINATIONS
  seed(
    'Semi-permanent manicure + semi-permanent pedicure + classic sole cleaning / Manicura con esmalte semipermanente + pedicura con esmalte semipermanente + limpieza clasica de planta',
    125,
    180,
    'nail-art-care-combinations',
    'EN: Combination with classic cleaning of the sole of the foot. ES: Combinacion con limpieza clasica de la planta del pie.'
  ),
  seed(
    'Gel manicure (Length 1-2) + semi-permanent pedicure + classic sole cleaning / Manicura con gel (longitud 1-2) + pedicura con esmalte semipermanente + limpieza clasica de planta',
    125,
    180,
    'nail-art-care-combinations',
    'EN: Combination with classic cleaning of the sole of the foot. ES: Combinacion con limpieza clasica de la planta del pie.'
  ),
  seed(
    'Hygienic manicure + hygienic pedicure + classic sole cleaning / Manicura higienica + pedicura higienica + limpieza clasica de planta',
    70,
    90,
    'nail-art-care-combinations',
    'EN: Combination with classic cleaning of the sole of the foot. ES: Combinacion con limpieza clasica de la planta del pie.'
  ),
  seed(
    'Semi-permanent manicure + semi-permanent pedicure / Manicura con esmalte semipermanente + pedicura con esmalte semipermanente',
    105,
    150,
    'nail-art-care-combinations',
    'EN: Combination without cleaning of the sole of the foot. ES: Combinacion sin limpieza de la planta del pie.'
  ),
  seed(
    'Gel manicure (Length 1-2) + semi-permanent pedicure / Manicura con gel (longitud 1-2) + pedicura con esmalte semipermanente',
    105,
    150,
    'nail-art-care-combinations',
    'EN: Combination without cleaning of the sole of the foot. ES: Combinacion sin limpieza de la planta del pie.'
  ),
  seed(
    'Hygienic manicure + hygienic pedicure / Manicura higienica + pedicura higienica',
    50,
    75,
    'nail-art-care-combinations',
    'EN: Combination without cleaning of the sole of the foot. ES: Combinacion sin limpieza de la planta del pie.'
  ),

  // PEDICURE & CARE
  seed('Semi-permanent gel polish (feet) / Esmaltado semipermanente (pies)', 50, 60, 'pedicure-care'),
  seed('Hygienic pedicure / Pedicura higienica', 30, 30, 'pedicure-care'),
  seed('Hygienic pedicure + classic polish / Pedicura higienica + esmalte clasico', 35, 40, 'pedicure-care'),
  seed('Classic sole cleaning + hydration / Limpieza clasica de planta + hidratacion', 20, 20, 'pedicure-care', 'EN: Uses KART professional products (Israel). ES: Se trabaja con productos profesionales KART (Israel).'),
  seed('Enzymatic sole peeling / Peeling enzimatico de planta', 35, 30, 'pedicure-care', 'EN: Recommended in winter and 2 weeks before/after sun or sea exposure. ES: Recomendado en invierno y 2 semanas antes/despues de sol o mar.'),
  seed('Keratolytic sole treatment + hydration / Tratamiento queratolitico + hidratacion', 50, 50, 'pedicure-care', 'EN: Not for clients with diabetes or neuropathy. ES: No reservar si hay diabetes o neuropatia; requiere protocolo medico autorizado.'),
];
