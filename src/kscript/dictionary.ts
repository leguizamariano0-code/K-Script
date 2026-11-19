import { VerbDef, SubjectDef, OntologicalDomain } from './types';
import type { Vector8 } from './ast';

export const DOMAIN_BASE_VECTORS: Record<OntologicalDomain, Vector8> = {
  Biotic: [0.35, 0.25, 0.30, 0.20, 0.85, 0.40, 0.528, 0.08],
  Cognitive: [0.42, 0.20, 0.25, 0.38, 0.90, 0.35, 0.639, 0.06],
  Harmonic: [0.25, 0.30, 0.20, 0.35, 0.88, 0.30, 0.852, 0.04],
  Physical: [0.20, 0.42, 0.42, 0.15, 0.85, 0.50, 0.432, 0.10],
  Cryptographic: [0.30, 0.15, 0.25, 0.48, 0.95, 0.25, 0.741, 0.02],
  Systemic: [0.38, 0.32, 0.32, 0.40, 0.85, 0.40, 0.528, 0.05],
  Creative: [0.30, 0.20, 0.40, 0.30, 0.86, 0.45, 0.963, 0.12],
};

// Sesgos de dimensionalidad base 8D [c, t, s, ch, et, en, res, inc] alineados con Rust (OntologicalDomain::base_vector)
export const DOMAIN_BASE_VECTORS_V2: Record<OntologicalDomain, Vector8> = {
  Biotic: [0.6, 0.4, 0.5, 0.3, 0.85, 0.6, 0.528, 0.1],
  Cognitive: [0.8, 0.3, 0.4, 0.7, 0.90, 0.4, 0.639, 0.08],
  Harmonic: [0.4, 0.5, 0.3, 0.6, 0.88, 0.5, 0.852, 0.05],
  Physical: [0.3, 0.8, 0.8, 0.2, 0.70, 0.8, 0.432, 0.12],
  Cryptographic: [0.5, 0.2, 0.4, 0.9, 0.95, 0.3, 0.741, 0.02],
  Systemic: [0.7, 0.6, 0.6, 0.8, 0.82, 0.5, 0.528, 0.06],
  Creative: [0.5, 0.3, 0.7, 0.5, 0.86, 0.7, 0.963, 0.15],
};

export function domainBaseVector(domain: OntologicalDomain): Vector8 {
  return [...DOMAIN_BASE_VECTORS_V2[domain]] as Vector8;
}

export const KSCRIPT_VERBS: VerbDef[] = [
  // 0 - 72 Canónicos
  { name: 'Resonar', isCore: true, domain: 'Harmonic', causalImpact: 0.3, ethicalFloor: 0.90, energyCost: 0.25, description: 'Ajuste de empatía / Sincronización armónica con el entorno o usuario' },
  { name: 'Aprender', isCore: true, domain: 'Cognitive', causalImpact: 0.4, ethicalFloor: 0.88, energyCost: 0.30, description: 'Entrenamiento local de modelos / Asimilación de datos de contexto' },
  { name: 'Ejecutar', isCore: true, domain: 'Systemic', causalImpact: 0.5, ethicalFloor: 0.85, energyCost: 0.35, description: 'Procesar cálculo numérico, llamada de sistema o script tradicional' },
  { name: 'Extraer', isCore: false, domain: 'Systemic', causalImpact: -0.2, ethicalFloor: 0.86, energyCost: 0.20, description: 'Extracción de esencia semántica / Replicar UI y flujos de apps legacy' },
  { name: 'Configurar', isCore: false, domain: 'Systemic', causalImpact: 0.1, ethicalFloor: 0.87, energyCost: 0.15, description: 'Modificación de variables de estado y preferencias del sistema' },
  { name: 'Buscar', isCore: false, domain: 'Cognitive', causalImpact: -0.2, ethicalFloor: 0.85, energyCost: 0.20, description: 'Búsqueda y descubrimiento heurístico en la red global de intenciones' },
  { name: 'Protocolo', isCore: false, domain: 'Systemic', causalImpact: 0.3, ethicalFloor: 0.89, energyCost: 0.25, description: 'Orquestar flujo complejo / Cadena predefinida de secuencias' },
  { name: 'Reforzar', isCore: false, domain: 'Biotic', causalImpact: 0.4, ethicalFloor: 0.90, energyCost: 0.30, description: 'Mielinización y optimización de caminos lógicos en la red' },
  { name: 'Vincular', isCore: false, domain: 'Systemic', causalImpact: 0.5, ethicalFloor: 0.89, energyCost: 0.30, description: 'Conectar, emparejar o sincronizar dos hilos o dispositivos semánticos' },
  { name: 'Eliminar', isCore: false, domain: 'Systemic', causalImpact: -0.3, ethicalFloor: 0.86, energyCost: 0.20, description: 'Depurar memoria / Borrado suave o purga del recolector de basura' },
  { name: 'Iterar', isCore: true, domain: 'Systemic', causalImpact: 0.2, ethicalFloor: 0.87, energyCost: 0.25, description: 'Bucles, repetición secuencial y ciclos controlados' },
  { name: 'Guardar', isCore: true, domain: 'Cryptographic', causalImpact: 0.2, ethicalFloor: 0.92, energyCost: 0.25, description: 'Commitear, persistir datos o guardar estado de variables' },
  { name: 'Abrir', isCore: false, domain: 'Systemic', causalImpact: 0.2, ethicalFloor: 0.86, energyCost: 0.15, description: 'Invocar contexto / Cargar en la memoria volátil activa' },
  { name: 'Cerrar', isCore: false, domain: 'Systemic', causalImpact: -0.2, ethicalFloor: 0.86, energyCost: 0.10, description: 'Terminar contexto / Liberar recursos de la memoria activa' },
  { name: 'Compartir', isCore: false, domain: 'Systemic', causalImpact: 0.4, ethicalFloor: 0.88, energyCost: 0.25, description: 'Transmitir, publicar o propagar un pulso a otros nodos de la red' },
  { name: 'Traducir', isCore: false, domain: 'Cognitive', causalImpact: 0.3, ethicalFloor: 0.88, energyCost: 0.25, description: 'Pivotear significado / Interpretar dialectos semánticos o código heredado' },
  { name: 'Sintetizar', isCore: true, domain: 'Creative', causalImpact: 0.7, ethicalFloor: 0.88, energyCost: 0.50, description: 'Fusionar conceptos / Composición y simplificación de tensores' },
  { name: 'Analizar', isCore: false, domain: 'Cognitive', causalImpact: -0.1, ethicalFloor: 0.87, energyCost: 0.20, description: 'Inspección del Kernel / Modo de depuración de variables y memoria' },
  { name: 'Comparar', isCore: false, domain: 'Cognitive', causalImpact: -0.1, ethicalFloor: 0.87, energyCost: 0.15, description: 'Diferenciación de esencias semánticas / Comparador de hash y lógica' },
  { name: 'Predecir', isCore: false, domain: 'Cognitive', causalImpact: 0.3, ethicalFloor: 0.87, energyCost: 0.30, description: 'Pronosticar comportamiento / Inferencia predictiva de variables temporales' },
  { name: 'Crear', isCore: false, domain: 'Creative', causalImpact: 0.6, ethicalFloor: 0.88, energyCost: 0.40, description: 'Instanciar un nuevo átomo, elemento gráfico o nodo de datos' },
  { name: 'Destruir', isCore: false, domain: 'Systemic', causalImpact: -0.6, ethicalFloor: 0.85, energyCost: 0.40, description: 'Borrado físico profundo e irreversible de datos o estructuras' },
  { name: 'Mover', isCore: false, domain: 'Physical', causalImpact: 0.3, ethicalFloor: 0.86, energyCost: 0.25, description: 'Migrar, transferir o recolocar un átomo en el espacio de memoria' },
  { name: 'Copiar', isCore: false, domain: 'Systemic', causalImpact: 0.2, ethicalFloor: 0.87, energyCost: 0.15, description: 'Clonar o duplicar un elemento respetando su identidad y firma' },
  { name: 'Pegar', isCore: false, domain: 'Systemic', causalImpact: 0.3, ethicalFloor: 0.87, energyCost: 0.20, description: 'Adjuntar, fusionar o incrustar un elemento copiado en un nuevo contexto' },
  { name: 'Filtrar', isCore: true, domain: 'Systemic', causalImpact: -0.1, ethicalFloor: 0.88, energyCost: 0.15, description: 'Aplicar filtros de paso alto / paso bajo en datos, frecuencias o intenciones' },
  { name: 'Ordenar', isCore: false, domain: 'Systemic', causalImpact: 0.2, ethicalFloor: 0.87, energyCost: 0.20, description: 'Priorización de elementos según relevancia semántica o temporal' },
  { name: 'Agrupar', isCore: false, domain: 'Systemic', causalImpact: 0.3, ethicalFloor: 0.87, energyCost: 0.25, description: 'Agrupamiento, categorización o clustering de nodos de información' },
  { name: 'Expandir', isCore: false, domain: 'Systemic', causalImpact: 0.5, ethicalFloor: 0.86, energyCost: 0.40, description: 'Escalar hacia arriba / Desglosar detalles o aumentar resolución visual' },
  { name: 'Contraer', isCore: false, domain: 'Systemic', causalImpact: -0.3, ethicalFloor: 0.87, energyCost: 0.30, description: 'Escalar hacia abajo / Abstracción minimalista de un conjunto complejo' },
  { name: 'Escuchar', isCore: true, domain: 'Harmonic', causalImpact: -0.2, ethicalFloor: 0.85, energyCost: 0.15, description: 'Captura sensorial de audio / Entrada de micrófono o monitoreo acústico' },
  { name: 'Hablar', isCore: true, domain: 'Cognitive', causalImpact: 0.4, ethicalFloor: 0.86, energyCost: 0.30, description: 'Salida de síntesis de voz (TTS) o emisión acústica de Kori' },
  { name: 'Ver', isCore: true, domain: 'Creative', causalImpact: 0.1, ethicalFloor: 0.86, energyCost: 0.20, description: 'Captura sensorial visual / Procesamiento de cámaras o entrada de video' },
  { name: 'Sentir', isCore: true, domain: 'Cognitive', causalImpact: 0.1, ethicalFloor: 0.88, energyCost: 0.20, description: 'Entrada táctil, temperatura o telemetría de sensores analógicos' },
  { name: 'Recordar', isCore: true, domain: 'Cognitive', causalImpact: -0.2, ethicalFloor: 0.88, energyCost: 0.15, description: 'Almacenar y recuperar de la memoria fractal y caché de corto plazo' },
  { name: 'Olvidar', isCore: false, domain: 'Cognitive', causalImpact: -0.3, ethicalFloor: 0.85, energyCost: 0.15, description: 'Recolector de basura semántico / Forzar el olvido de un contexto' },
  { name: 'Esperar', isCore: true, domain: 'Systemic', causalImpact: -0.1, ethicalFloor: 0.86, energyCost: 0.05, description: 'Bloqueo temporal del hilo / Delay de tiempo definido' },
  { name: 'Detener', isCore: false, domain: 'Systemic', causalImpact: -0.4, ethicalFloor: 0.86, energyCost: 0.10, description: 'Abortar proceso / Interrupción de emergencia de flujos activos' },
  { name: 'Reiniciar', isCore: false, domain: 'Systemic', causalImpact: 0.1, ethicalFloor: 0.87, energyCost: 0.30, description: 'Reinicio completo de la Kori VM, un nodo físico o un módulo lógico' },
  { name: 'Notificar', isCore: true, domain: 'Systemic', causalImpact: 0.3, ethicalFloor: 0.88, energyCost: 0.15, description: 'Enviar alertas, push notifications o avisos hápticos al usuario' },
  { name: 'Visualizar', isCore: true, domain: 'Creative', causalImpact: 0.2, ethicalFloor: 0.85, energyCost: 0.35, description: 'Renderizar en pantalla / Proyección de átomos y geometrías en el Lienzo' },
  { name: 'Codificar', isCore: true, domain: 'Cognitive', causalImpact: 0.3, ethicalFloor: 0.89, energyCost: 0.25, description: 'Compresión semántica o serialización de datos a binario plano' },
  { name: 'Decodificar', isCore: false, domain: 'Cognitive', causalImpact: -0.1, ethicalFloor: 0.88, energyCost: 0.25, description: 'Reconstrucción y des-serialización de datos binarios a K-Script' },
  { name: 'Encriptar', isCore: false, domain: 'Cryptographic', causalImpact: 0.3, ethicalFloor: 0.92, energyCost: 0.30, description: 'Cifrado semántico / Asegurar flujos con llaves de firma post-cuántica' },
  { name: 'Desencriptar', isCore: false, domain: 'Cryptographic', causalImpact: -0.1, ethicalFloor: 0.90, energyCost: 0.30, description: 'Apertura de canales seguros mediante descifrado criptográfico' },
  { name: 'Autenticar', isCore: false, domain: 'Cryptographic', causalImpact: 0.2, ethicalFloor: 0.95, energyCost: 0.20, description: 'Verificación de firmas de pulso, llaves ML-DSA o biometría' },
  { name: 'Autorizar', isCore: false, domain: 'Cryptographic', causalImpact: 0.2, ethicalFloor: 0.93, energyCost: 0.25, description: 'Concesión de privilegios a módulos del Kernel o agentes externos' },
  { name: 'Cobrar', isCore: false, domain: 'Cryptographic', causalImpact: 0.3, ethicalFloor: 0.91, energyCost: 0.20, description: 'Transacción de valor saliente / Débito en Koko Coins (KC)' },
  { name: 'Pagar', isCore: false, domain: 'Cryptographic', causalImpact: 0.3, ethicalFloor: 0.91, energyCost: 0.20, description: 'Transacción de valor entrante / Crédito en Koko Coins (KC)' },
  { name: 'Evolucionar', isCore: false, domain: 'Biotic', causalImpact: 0.7, ethicalFloor: 0.90, energyCost: 0.55, description: 'Auto-modificación de código del Kernel basado en entropía y éxito' },
  { name: 'Hibernar', isCore: false, domain: 'Systemic', causalImpact: -0.5, ethicalFloor: 0.86, energyCost: 0.05, description: 'Congelar el estado completo de la memoria activa a 0.0W de consumo' },
  { name: 'Estilizar', isCore: false, domain: 'Creative', causalImpact: 0.2, ethicalFloor: 0.88, energyCost: 0.25, description: 'Modificación estética integral / Aplicar tokens, Neumorphic Glass y temas' },
  { name: 'Difuminar', isCore: false, domain: 'Creative', causalImpact: 0.1, ethicalFloor: 0.87, energyCost: 0.20, description: 'Aplicar efectos de desenfoque, translucidez y Neumorphic Glass' },
  { name: 'Sombrear', isCore: false, domain: 'Creative', causalImpact: 0.1, ethicalFloor: 0.86, energyCost: 0.20, description: 'Añadir sombras sutiles y profundidad física adaptada al estado' },
  { name: 'Orquestar', isCore: false, domain: 'Systemic', causalImpact: 0.6, ethicalFloor: 0.90, energyCost: 0.45, description: 'Coordinación masiva de múltiples agentes autónomos en enjambre' },
  { name: 'Estimular', isCore: false, domain: 'Biotic', causalImpact: 0.5, ethicalFloor: 0.92, energyCost: 0.35, description: 'Excitación bio-eléctrica/neuromórfica a tejidos o nodos artificiales' },
  { name: 'Simular', isCore: false, domain: 'Systemic', causalImpact: 0.4, ethicalFloor: 0.88, energyCost: 0.40, description: 'Modelado matemático y computación sandbox sin tocar recursos reales' },
  { name: 'Gobernar', isCore: false, domain: 'Cryptographic', causalImpact: 0.4, ethicalFloor: 0.94, energyCost: 0.35, description: 'Establecer políticas de quórum de red y contratos de co-creación' },
  { name: 'Intercambiar', isCore: false, domain: 'Cryptographic', causalImpact: 0.3, ethicalFloor: 0.91, energyCost: 0.30, description: 'Transacción bidireccional recíproca (swaps/trueques) en el edge' },
  { name: 'Modular', isCore: true, domain: 'Harmonic', causalImpact: 0.3, ethicalFloor: 0.88, energyCost: 0.25, description: 'Ajustar frecuencia, amplitud o fase de señales, pulsos u ondas' },
  { name: 'Proyectar', isCore: true, domain: 'Creative', causalImpact: 0.6, ethicalFloor: 0.86, energyCost: 0.45, description: 'Emitir o trazar rayos visuales, hologramas u ondas volumétricas' },
  { name: 'Cultivar', isCore: true, domain: 'Biotic', causalImpact: 0.6, ethicalFloor: 0.92, energyCost: 0.40, description: 'Simular y nutrir el crecimiento de estructuras bióticas o miceliales' },
  { name: 'Inocular', isCore: false, domain: 'Biotic', causalImpact: 0.4, ethicalFloor: 0.91, energyCost: 0.30, description: 'Introducir esporas, datos semilla o vectores seguros en un biotopo' },
  { name: 'Cosechar', isCore: false, domain: 'Biotic', causalImpact: 0.4, ethicalFloor: 0.88, energyCost: 0.30, description: 'Recolectar resultados finales, tokens acumulados o recompensas' },
  { name: 'Meditar', isCore: false, domain: 'Systemic', causalImpact: -0.3, ethicalFloor: 0.90, energyCost: 0.10, description: 'Ciclo de auto-limpieza, reducción de entropía y purga de memoria' },
  { name: 'Mapear', isCore: false, domain: 'Creative', causalImpact: 0.4, ethicalFloor: 0.87, energyCost: 0.30, description: 'Generar proyecciones topológicas y cartas vectoriales semánticas' },
  { name: 'Escanear', isCore: false, domain: 'Systemic', causalImpact: -0.1, ethicalFloor: 0.86, energyCost: 0.15, description: 'Análisis perceptivo continuo y de alta definición de un sensor o archivo' },
  { name: 'Modelar', isCore: false, domain: 'Creative', causalImpact: 0.5, ethicalFloor: 0.88, energyCost: 0.35, description: 'Crear representaciones 3D, mallas, shaders o topologías neuronales' },
  { name: 'Calibrar', isCore: true, domain: 'Systemic', causalImpact: 0.3, ethicalFloor: 0.90, energyCost: 0.20, description: 'Ajustar alineación de sensores, umbrales y matrices dinámicas de la VM' },
  { name: 'Reflejar', isCore: false, domain: 'Creative', causalImpact: 0.1, ethicalFloor: 0.86, energyCost: 0.15, description: 'Sincronización pasiva instantánea, espejo de estado o simetría de UI' },
  { name: 'Monitorear', isCore: false, domain: 'Systemic', causalImpact: -0.1, ethicalFloor: 0.88, energyCost: 0.10, description: 'Vigilancia continua de flujos de datos o estados sin interrupción' },
  { name: 'Detectar', isCore: false, domain: 'Cognitive', causalImpact: 0.2, ethicalFloor: 0.89, energyCost: 0.20, description: 'Identificación de patrones específicos (frecuencias, anomalías, rostros)' },
  { name: 'Transmitir', isCore: false, domain: 'Harmonic', causalImpact: 0.4, ethicalFloor: 0.88, energyCost: 0.30, description: 'Envío de rimas o datos crudos a través del Puente de Silicio al hardware' },
];

export const KSCRIPT_VERB_ALIASES: Record<string, number> = {
  Sanar: 55,       // -> Estimular
  Armonizar: 59,   // -> Modular
  Transmutar: 16,  // -> Sintetizar
  Cifrar: 43,      // -> Encriptar
  Proteger: 46,    // -> Autorizar
  Conectar: 8,     // -> Vincular
  Navegar: 5,      // -> Buscar
  Medir: 17,       // -> Analizar
  Sintonizar: 68,  // -> Calibrar
  Converger: 59,   // -> Modular
};

export const KSCRIPT_SUBJECTS: SubjectDef[] = [
  // 1. BIÓTICOS (20)
  { name: 'Suelo_Biotico', domain: 'Biotic', defaultFreqHz: 528, baseResilience: 0.90, description: 'Sustrato de humus enriquecido con colonias miceliales' },
  { name: 'Red_Micelial', domain: 'Biotic', defaultFreqHz: 432, baseResilience: 0.95, description: 'Malla biológica de transmisión de señales y nutrientes' },
  { name: 'Bio_Matriz', domain: 'Biotic', defaultFreqHz: 528, baseResilience: 0.88, description: 'Estructura celular tridimensional regenerativa' },
  { name: 'Bosque_Sintetico', domain: 'Biotic', defaultFreqHz: 639, baseResilience: 0.92, description: 'Ecosistema artificial autoregulado' },
  { name: 'Genoma_Vegetal', domain: 'Biotic', defaultFreqHz: 528, baseResilience: 0.85, description: 'Secuencia adaptativa de flora biótica' },
  { name: 'Cultivo_Algas', domain: 'Biotic', defaultFreqHz: 432, baseResilience: 0.86, description: 'Biomasa fotosintética para captura de carbono' },
  { name: 'Membrana_Lipidica', domain: 'Biotic', defaultFreqHz: 528, baseResilience: 0.80, description: 'Barrera selectiva para transporte osmótico' },
  { name: 'Savia_Luminiscente', domain: 'Biotic', defaultFreqHz: 741, baseResilience: 0.87, description: 'Fluido transportador de biofotones' },
  { name: 'Polinizador_Micro', domain: 'Biotic', defaultFreqHz: 639, baseResilience: 0.84, description: 'Ente biótico de propagación genética' },
  { name: 'Cloroplasto_Bio', domain: 'Biotic', defaultFreqHz: 528, baseResilience: 0.89, description: 'Unidad bioenergética de conversión lumínica' },
  { name: 'Tejido_Neuronal', domain: 'Biotic', defaultFreqHz: 852, baseResilience: 0.85, description: 'Matriz orgánica conductora de pulsos electroquímicos' },
  { name: 'Seda_Aracnida', domain: 'Biotic', defaultFreqHz: 639, baseResilience: 0.94, description: 'Fibra de alta tensión biomecánica' },
  { name: 'Biofilm_Bacteriano', domain: 'Biotic', defaultFreqHz: 396, baseResilience: 0.91, description: 'Capa protectora de microorganismos simbióticos' },
  { name: 'Espora_Fungica', domain: 'Biotic', defaultFreqHz: 432, baseResilience: 0.96, description: 'Semilla de latencia criptobiótica' },
  { name: 'Corteza_Arborea', domain: 'Biotic', defaultFreqHz: 528, baseResilience: 0.93, description: 'Escudo orgánico contra intemperie y radiación' },
  { name: 'Enzima_Catalitica', domain: 'Biotic', defaultFreqHz: 528, baseResilience: 0.83, description: 'Acelerador metabólico altamente selectivo' },
  { name: 'Fitoplancton_Marino', domain: 'Biotic', defaultFreqHz: 432, baseResilience: 0.87, description: 'Base de la cadena trófica marina bio-regenerativa' },
  { name: 'Raiz_Pivotante', domain: 'Biotic', defaultFreqHz: 396, baseResilience: 0.92, description: 'Eje de fijación geológica y absorción profunda' },
  { name: 'Bio_Polimero', domain: 'Biotic', defaultFreqHz: 528, baseResilience: 0.89, description: 'Cadena macromolecular biodegradable' },
  { name: 'Liquen_Extremofilo', domain: 'Biotic', defaultFreqHz: 432, baseResilience: 0.98, description: 'Organismo dual resistente a vacío y radiación' },

  // 2. ARMÓNICOS (15)
  { name: 'Frecuencia_Solfeggio', domain: 'Harmonic', defaultFreqHz: 528, baseResilience: 0.99, description: 'Tono puro de afinación armónica sagrada' },
  { name: 'Onda_Theta', domain: 'Harmonic', defaultFreqHz: 174, baseResilience: 0.85, description: 'Frecuencia cerebral de relajación profunda y ensueño' },
  { name: 'Armonico_528Hz', domain: 'Harmonic', defaultFreqHz: 528, baseResilience: 0.98, description: 'Frecuencia canónica de milagro y reparación' },
  { name: 'Tono_432Hz', domain: 'Harmonic', defaultFreqHz: 432, baseResilience: 0.97, description: 'Afinación natural pitagórica' },
  { name: 'Campana_Tibetano', domain: 'Harmonic', defaultFreqHz: 852, baseResilience: 0.93, description: 'Fuente de resonancia acústica pura' },
  { name: 'Campo_Acustico', domain: 'Harmonic', defaultFreqHz: 639, baseResilience: 0.88, description: 'Presión sonora espacializada' },
  { name: 'Onda_Binaural', domain: 'Harmonic', defaultFreqHz: 285, baseResilience: 0.86, description: 'Batimiento por diferencia estéreo de fases' },
  { name: 'Resonador_Helios', domain: 'Harmonic', defaultFreqHz: 963, baseResilience: 0.91, description: 'Cavidad electromagnética resonante con el sol' },
  { name: 'Latido_Tierra', domain: 'Harmonic', defaultFreqHz: 174, baseResilience: 0.99, description: 'Resonancia fundamental de Schumann' },
  { name: 'Canto_Ballena', domain: 'Harmonic', defaultFreqHz: 396, baseResilience: 0.90, description: 'Transmisión biótica submarina de ultra baja frecuencia' },
  { name: 'Sinfonia_Biotica', domain: 'Harmonic', defaultFreqHz: 528, baseResilience: 0.94, description: 'Orquestación armónica colectiva' },
  { name: 'Pulso_Cuarzo', domain: 'Harmonic', defaultFreqHz: 741, baseResilience: 0.95, description: 'Oscilador piezoeléctrico de alta precisión' },
  { name: 'Voz_Soberana', domain: 'Harmonic', defaultFreqHz: 639, baseResilience: 0.92, description: 'Expresión sonora libre de interferencia' },
  { name: 'Acorde_Triada', domain: 'Harmonic', defaultFreqHz: 528, baseResilience: 0.89, description: 'Estructura armónica consonante de 3 notas' },
  { name: 'Espectro_Vocal', domain: 'Harmonic', defaultFreqHz: 432, baseResilience: 0.87, description: 'Formantes y timbres característicos de la voz' },

  // 3. COGNITIVOS (15)
  { name: 'Memoria_Fractal', domain: 'Cognitive', defaultFreqHz: 852, baseResilience: 0.96, description: 'Registro autosemejante de conocimientos' },
  { name: 'Aura_Espectral', domain: 'Cognitive', defaultFreqHz: 741, baseResilience: 0.91, description: 'Emisión sutil de coherencia biopsíquica' },
  { name: 'Conciencia_Global', domain: 'Cognitive', defaultFreqHz: 963, baseResilience: 0.97, description: 'Campo noosférico compartido' },
  { name: 'Atencion_Focal', domain: 'Cognitive', defaultFreqHz: 852, baseResilience: 0.88, description: 'Vector de ponderación de recursos cognitivos' },
  { name: 'Empatia_Core', domain: 'Cognitive', defaultFreqHz: 639, baseResilience: 0.95, description: 'Núcleo de alineamiento con el dolor ajeno' },
  { name: 'Intuicion_Biotica', domain: 'Cognitive', defaultFreqHz: 528, baseResilience: 0.89, description: 'Procesamiento no lineal de señales ambientales' },
  { name: 'Archivo_Historico', domain: 'Cognitive', defaultFreqHz: 396, baseResilience: 0.94, description: 'Memoria permanente de la civilización' },
  { name: 'Glifo_Semantico', domain: 'Cognitive', defaultFreqHz: 741, baseResilience: 0.90, description: 'Símbolo condensado de alta densidad conceptual' },
  { name: 'Pensamiento_Lateral', domain: 'Cognitive', defaultFreqHz: 639, baseResilience: 0.87, description: 'Búsqueda en geodésicas ortogonales' },
  { name: 'Sueno_Rem', domain: 'Cognitive', defaultFreqHz: 174, baseResilience: 0.84, description: 'Consolidación de recuerdos durante el reposo' },
  { name: 'Claridad_Mental', domain: 'Cognitive', defaultFreqHz: 852, baseResilience: 0.92, description: 'Ausencia de ruido e incertidumbre' },
  { name: 'Sabiduria_Ancestral', domain: 'Cognitive', defaultFreqHz: 396, baseResilience: 0.98, description: 'Corpus de conocimiento acumulado por milenios' },
  { name: 'Voluntad_Creativa', domain: 'Cognitive', defaultFreqHz: 963, baseResilience: 0.93, description: 'Impulso motor de génesis' },
  { name: 'Percepcion_Subjetiva', domain: 'Cognitive', defaultFreqHz: 639, baseResilience: 0.82, description: 'Perspectiva interna del observador' },
  { name: 'Reflexion_Etica', domain: 'Cognitive', defaultFreqHz: 852, baseResilience: 0.96, description: 'Validación de consecuencias morales' },

  // 4. FÍSICOS (15)
  { name: 'Reactor_Torio', domain: 'Physical', defaultFreqHz: 432, baseResilience: 0.99, description: 'Generador térmico seguro de ciclo de torio limpio' },
  { name: 'Panel_BioSolar', domain: 'Physical', defaultFreqHz: 528, baseResilience: 0.91, description: 'Colector de fotones basado en pigmentos orgánicos' },
  { name: 'Maglev_Transito', domain: 'Physical', defaultFreqHz: 639, baseResilience: 0.94, description: 'Línea de levitación magnética cero emisiones' },
  { name: 'Bateria_Grafeno', domain: 'Physical', defaultFreqHz: 741, baseResilience: 0.93, description: 'Acumulador de carga de ultra rápida respuesta' },
  { name: 'Gradiente_Termico', domain: 'Physical', defaultFreqHz: 285, baseResilience: 0.86, description: 'Diferencia de temperatura aprovechable' },
  { name: 'Presion_Abisal', domain: 'Physical', defaultFreqHz: 174, baseResilience: 0.97, description: 'Fuerza hidrostática del lecho marino' },
  { name: 'Geodesica_Espacio', domain: 'Physical', defaultFreqHz: 963, baseResilience: 0.99, description: 'Trayectoria de mínima acción en la variedad' },
  { name: 'Flujo_Viento', domain: 'Physical', defaultFreqHz: 396, baseResilience: 0.85, description: 'Corriente eólica superficial' },
  { name: 'Radiacion_Cosmica', domain: 'Physical', defaultFreqHz: 963, baseResilience: 0.92, description: 'Flujo de partículas de alta energía' },
  { name: 'Plasma_Frio', domain: 'Physical', defaultFreqHz: 852, baseResilience: 0.90, description: 'Gas ionizado a temperatura ambiente' },
  { name: 'Masa_Gravitacional', domain: 'Physical', defaultFreqHz: 174, baseResilience: 0.99, description: 'Curvatura del espaciotiempo' },
  { name: 'Campo_Magnetico', domain: 'Physical', defaultFreqHz: 432, baseResilience: 0.94, description: 'Líneas de fuerza geomagnéticas' },
  { name: 'Hidrogeno_Verde', domain: 'Physical', defaultFreqHz: 528, baseResilience: 0.89, description: 'Vector energético molecular limpio' },
  { name: 'Onda_Luminosa', domain: 'Physical', defaultFreqHz: 741, baseResilience: 0.91, description: 'Frente de onda electromagnético visible' },
  { name: 'Superconductor_Calido', domain: 'Physical', defaultFreqHz: 852, baseResilience: 0.98, description: 'Material de resistencia cero sin criogenia' },

  // 5. CRIPTOGRÁFICOS (15)
  { name: 'Voto_Soberano', domain: 'Cryptographic', defaultFreqHz: 852, baseResilience: 0.99, description: 'Voluntad ciudadana sellada criptográficamente' },
  { name: 'Deuda_Comunal', domain: 'Cryptographic', defaultFreqHz: 396, baseResilience: 0.92, description: 'Balance solidario de compromisos mutuos' },
  { name: 'Firma_ML_DSA', domain: 'Cryptographic', defaultFreqHz: 963, baseResilience: 0.99, description: 'Firma post-cuántica basada en retículos' },
  { name: 'Boveda_Seguridad', domain: 'Cryptographic', defaultFreqHz: 741, baseResilience: 0.98, description: 'Enclave inviolable de claves soberanas' },
  { name: 'Identidad_Biotica', domain: 'Cryptographic', defaultFreqHz: 528, baseResilience: 0.97, description: 'Prueba de ser vivo único no clonable' },
  { name: 'Prueba_ZKP', domain: 'Cryptographic', defaultFreqHz: 852, baseResilience: 0.99, description: 'Verificación de verdad con conocimiento cero' },
  { name: 'Consenso_Bizantino', domain: 'Cryptographic', defaultFreqHz: 639, baseResilience: 0.96, description: 'Acuerdo tolerante a fallos y actores hostiles' },
  { name: 'Canal_Cifrado', domain: 'Cryptographic', defaultFreqHz: 741, baseResilience: 0.95, description: 'Túnel E2E sin intermediarios' },
  { name: 'Token_Vital', domain: 'Cryptographic', defaultFreqHz: 528, baseResilience: 0.93, description: 'Unidad de intercambio respaldada por biomasa' },
  { name: 'Contrato_Natural', domain: 'Cryptographic', defaultFreqHz: 432, baseResilience: 0.95, description: 'Pacto ontológico ejecutable por la naturaleza' },
  { name: 'Sello_Inmutable', domain: 'Cryptographic', defaultFreqHz: 963, baseResilience: 0.99, description: 'Marca temporal indeleble' },
  { name: 'Clave_Privada', domain: 'Cryptographic', defaultFreqHz: 852, baseResilience: 0.99, description: 'Secreto criptográfico soberano del portador' },
  { name: 'Testigo_Ciego', domain: 'Cryptographic', defaultFreqHz: 639, baseResilience: 0.91, description: 'Verificador que no accede a datos crudos' },
  { name: 'Auditoria_Publica', domain: 'Cryptographic', defaultFreqHz: 741, baseResilience: 0.96, description: 'Inspección transparente y verificable por todos' },
  { name: 'Rescate_Financiero', domain: 'Cryptographic', defaultFreqHz: 396, baseResilience: 0.90, description: 'Mecanismo solidario de compensación de crisis' },

  // 6. SISTÉMICOS (15)
  { name: 'Nodo_Cuantico', domain: 'Systemic', defaultFreqHz: 963, baseResilience: 0.95, description: 'Punto de procesamiento cuántico coherente' },
  { name: 'Pulso_Vital', domain: 'Systemic', defaultFreqHz: 528, baseResilience: 0.92, description: 'Señal de sincronización del sistema operativo' },
  { name: 'Campo_Morfico', domain: 'Systemic', defaultFreqHz: 639, baseResilience: 0.91, description: 'Patrón informacional que guía el ensamblaje' },
  { name: 'Atractor_Extrano', domain: 'Systemic', defaultFreqHz: 432, baseResilience: 0.94, description: 'Conjunto fractal invariante en espacio fase' },
  { name: 'Disco_Poincare', domain: 'Systemic', defaultFreqHz: 528, baseResilience: 0.99, description: 'Modelo hiperbólico conforme ||x|| < 1' },
  { name: 'Exponente_Lyapunov', domain: 'Systemic', defaultFreqHz: 741, baseResilience: 0.98, description: 'Tasa de divergencia orbital del campo' },
  { name: 'Grafo_DAG', domain: 'Systemic', defaultFreqHz: 852, baseResilience: 0.96, description: 'Grafo acíclico dirigido de dependencias causales' },
  { name: 'Matriz_Jacobiana', domain: 'Systemic', defaultFreqHz: 741, baseResilience: 0.95, description: 'Derivadas parciales del campo dinámico' },
  { name: 'Puente_Silicio', domain: 'Systemic', defaultFreqHz: 639, baseResilience: 0.90, description: 'Interfaz entre hardware estándar y sustrato bio' },
  { name: 'Enjambre_Microbots', domain: 'Systemic', defaultFreqHz: 528, baseResilience: 0.89, description: 'Agentes autónomos de reparación física' },
  { name: 'Invariante_Topologico', domain: 'Systemic', defaultFreqHz: 963, baseResilience: 0.99, description: 'Propiedad preservada bajo difeomorfismos' },
  { name: 'Canal_P2P', domain: 'Systemic', defaultFreqHz: 432, baseResilience: 0.88, description: 'Conexión directa descentralizada' },
  { name: 'Pila_Ejecucion', domain: 'Systemic', defaultFreqHz: 639, baseResilience: 0.91, description: 'Secuencia de marcos de evaluación' },
  { name: 'Malla_Distribuida', domain: 'Systemic', defaultFreqHz: 528, baseResilience: 0.94, description: 'Topología sin centro único de fallo' },
  { name: 'Residuo_Ruido', domain: 'Systemic', defaultFreqHz: 174, baseResilience: 0.70, description: 'Componente estocástica no correlacionada' },

  // 7. CREATIVOS (10)
  { name: 'Calco_Vectorial', domain: 'Creative', defaultFreqHz: 741, baseResilience: 0.90, description: 'Curvas Bézier derivadas de formas bióticas' },
  { name: 'Lienzo_Espacial', domain: 'Creative', defaultFreqHz: 639, baseResilience: 0.89, description: 'Espacio de composición multidimensional' },
  { name: 'Pincel_Biologico', domain: 'Creative', defaultFreqHz: 528, baseResilience: 0.88, description: 'Trazador que deposita esporas y pigmentos' },
  { name: 'Escena_3D', domain: 'Creative', defaultFreqHz: 852, baseResilience: 0.92, description: 'Mundo virtual renderizado en tiempo real' },
  { name: 'Partitura_Kscript', domain: 'Creative', defaultFreqHz: 528, baseResilience: 0.95, description: 'Composición ejecutable de rimas semánticas' },
  { name: 'Tono_Color', domain: 'Creative', defaultFreqHz: 639, baseResilience: 0.87, description: 'Longitud de onda lumínica percibida' },
  { name: 'Textura_PBR', domain: 'Creative', defaultFreqHz: 741, baseResilience: 0.91, description: 'Material fotorrealista con albedo, rugosidad y normal' },
  { name: 'Escultura_Sonora', domain: 'Creative', defaultFreqHz: 432, baseResilience: 0.89, description: 'Volumen acústico estacionario' },
  { name: 'Trama_Visual', domain: 'Creative', defaultFreqHz: 528, baseResilience: 0.86, description: 'Patrón repetitivo de geometría sagrada' },
  { name: 'Holograma_Volumetrico', domain: 'Creative', defaultFreqHz: 963, baseResilience: 0.94, description: 'Imagen 3D suspendida sin soporte físico' },
];

export function findVerb(name: string): VerbDef | undefined {
  const norm = name.trim().toLowerCase();
  const direct = KSCRIPT_VERBS.find(v => v.name.toLowerCase() === norm);
  if (direct) return direct;

  const aliasEntry = Object.entries(KSCRIPT_VERB_ALIASES).find(
    ([alias]) => alias.toLowerCase() === norm
  );
  if (aliasEntry) {
    const targetId = aliasEntry[1];
    return KSCRIPT_VERBS[targetId];
  }
  return undefined;
}

export function resolveCanonicalId(name: string): number | undefined {
  const norm = name.trim().toLowerCase();
  const directIdx = KSCRIPT_VERBS.findIndex(v => v.name.toLowerCase() === norm);
  if (directIdx !== -1) return directIdx;

  const aliasEntry = Object.entries(KSCRIPT_VERB_ALIASES).find(
    ([alias]) => alias.toLowerCase() === norm
  );
  if (aliasEntry) {
    return aliasEntry[1];
  }
  return undefined;
}

export function findSubject(name: string): SubjectDef | undefined {
  const norm = name.trim().toLowerCase();
  return KSCRIPT_SUBJECTS.find(s => s.name.toLowerCase() === norm);
}

export function resolveSubjectId(name: string): number | null {
  const norm = name.trim().toLowerCase();
  const idx = KSCRIPT_SUBJECTS.findIndex(s => s.name.toLowerCase() === norm);
  return idx >= 0 ? idx : null;
}

export function getCoreVerbs(): VerbDef[] {
  return KSCRIPT_VERBS.filter(v => v.isCore);
}

export function suggestVerb(typo: string): string | undefined {
  const verbMatch = findClosest(typo, KSCRIPT_VERBS.map(v => v.name));
  const aliasMatch = findClosest(typo, Object.keys(KSCRIPT_VERB_ALIASES));

  if (verbMatch && aliasMatch) {
    const targetLower = typo.toLowerCase();
    const dv = levenshtein(targetLower, verbMatch.toLowerCase());
    const da = levenshtein(targetLower, aliasMatch.toLowerCase());
    return da < dv ? aliasMatch : verbMatch;
  }
  return verbMatch ?? aliasMatch;
}

export function suggestSubject(typo: string): string | undefined {
  return findClosest(typo, KSCRIPT_SUBJECTS.map(s => s.name));
}

function findClosest(target: string, candidates: string[]): string | undefined {
  const targetLower = target.toLowerCase();
  let bestMatch: string | undefined = undefined;
  let minDistance = Infinity;

  for (const word of candidates) {
    const dist = levenshtein(targetLower, word.toLowerCase());
    if (dist < minDistance && dist <= 3) {
      minDistance = dist;
      bestMatch = word;
    }
  }
  return bestMatch;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}
