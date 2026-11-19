//! Diccionario canónico de K-Script (73 Verbos y 105 Sujetos).
//! Define el vocabulario formal, dominios ontológicos y proyecciones 8D base.

/// Dominio ontológico de un término.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum OntologicalDomain {
    Biotic,          // Biología, micelio, suelos, células, vida
    Cognitive,       // Memoria, conciencia, atención, ética
    Harmonic,        // Frecuencias, Solfeggio, resonancia, música
    Physical,        // Energía, física, espacio, materia, reactores
    Cryptographic,   // Cifrado, firmas, consenso, soberanía, ML-DSA
    Systemic,        // Topología, redes, agentes, flujo, invariantes
    Creative,        // Síntesis, transmutación, arte, visualización
}

impl OntologicalDomain {
    pub fn as_str(&self) -> &'static str {
        match self {
            OntologicalDomain::Biotic => "Biótico",
            OntologicalDomain::Cognitive => "Cognitivo",
            OntologicalDomain::Harmonic => "Armónico",
            OntologicalDomain::Physical => "Físico",
            OntologicalDomain::Cryptographic => "Criptográfico",
            OntologicalDomain::Systemic => "Sistémico",
            OntologicalDomain::Creative => "Creativo",
        }
    }

    /// Sesgo de dimensionalidad base en el espacio 8D [c, t, s, ch, et, en, res, inc]
    pub fn base_vector(&self) -> [f64; 8] {
        match self {
            OntologicalDomain::Biotic => [0.6, 0.4, 0.5, 0.3, 0.85, 0.6, 0.528, 0.1],
            OntologicalDomain::Cognitive => [0.8, 0.3, 0.4, 0.7, 0.90, 0.4, 0.639, 0.08],
            OntologicalDomain::Harmonic => [0.4, 0.5, 0.3, 0.6, 0.88, 0.5, 0.852, 0.05],
            OntologicalDomain::Physical => [0.3, 0.8, 0.8, 0.2, 0.70, 0.8, 0.432, 0.12],
            OntologicalDomain::Cryptographic => [0.5, 0.2, 0.4, 0.9, 0.95, 0.3, 0.741, 0.02],
            OntologicalDomain::Systemic => [0.7, 0.6, 0.6, 0.8, 0.82, 0.5, 0.528, 0.06],
            OntologicalDomain::Creative => [0.5, 0.3, 0.7, 0.5, 0.86, 0.7, 0.963, 0.15],
        }
    }
}

/// Definición canónica de un Verbo K-Script.
#[derive(Debug, Clone)]
pub struct VerbDef {
    pub name: &'static str,
    pub is_core: bool,
    pub domain: OntologicalDomain,
    pub causal_impact: f64,    // Influencia en dimensión causal [-1.0, 1.0]
    pub ethical_floor: f64,    // Mínimo de ética garantizado [0.0, 1.0]
    pub energy_cost: f64,      // Demanda energética [0.0, 1.0]
    pub description: &'static str,
}

/// Definición canónica de un Sujeto K-Script.
#[derive(Debug, Clone)]
pub struct SubjectDef {
    pub name: &'static str,
    pub domain: OntologicalDomain,
    pub default_freq_hz: Option<f64>,
    pub base_resilience: f64,
    pub description: &'static str,
}

/// Diccionario Maestro de K-Script.
pub struct KScriptDictionary;

impl KScriptDictionary {
    /// 73 Verbos Canónicos de K-Script (IDs 0 - 72)
    pub const VERBS: &'static [VerbDef] = &[
        // 0..72 Canónicos
        VerbDef { name: "Resonar", is_core: true, domain: OntologicalDomain::Harmonic, causal_impact: 0.3, ethical_floor: 0.90, energy_cost: 0.25, description: "Ajuste de empatía / Sincronización armónica con el entorno o usuario" },
        VerbDef { name: "Aprender", is_core: true, domain: OntologicalDomain::Cognitive, causal_impact: 0.4, ethical_floor: 0.88, energy_cost: 0.30, description: "Entrenamiento local de modelos / Asimilación de datos de contexto" },
        VerbDef { name: "Ejecutar", is_core: true, domain: OntologicalDomain::Systemic, causal_impact: 0.5, ethical_floor: 0.85, energy_cost: 0.35, description: "Procesar cálculo numérico, llamada de sistema o script tradicional" },
        VerbDef { name: "Extraer", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.2, ethical_floor: 0.86, energy_cost: 0.20, description: "Extracción de esencia semántica / Replicar UI y flujos de apps legacy" },
        VerbDef { name: "Configurar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.1, ethical_floor: 0.87, energy_cost: 0.15, description: "Modificación de variables de estado y preferencias del sistema" },
        VerbDef { name: "Buscar", is_core: false, domain: OntologicalDomain::Cognitive, causal_impact: -0.2, ethical_floor: 0.85, energy_cost: 0.20, description: "Búsqueda y descubrimiento heurístico en la red global de intenciones" },
        VerbDef { name: "Protocolo", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.3, ethical_floor: 0.89, energy_cost: 0.25, description: "Orquestar flujo complejo / Cadena predefinida de secuencias" },
        VerbDef { name: "Reforzar", is_core: false, domain: OntologicalDomain::Biotic, causal_impact: 0.4, ethical_floor: 0.90, energy_cost: 0.30, description: "Mielinización y optimización de caminos lógicos en la red" },
        VerbDef { name: "Vincular", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.5, ethical_floor: 0.89, energy_cost: 0.30, description: "Conectar, emparejar o sincronizar dos hilos o dispositivos semánticos" },
        VerbDef { name: "Eliminar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.3, ethical_floor: 0.86, energy_cost: 0.20, description: "Depurar memoria / Borrado suave o purga del recolector de basura" },
        VerbDef { name: "Iterar", is_core: true, domain: OntologicalDomain::Systemic, causal_impact: 0.2, ethical_floor: 0.87, energy_cost: 0.25, description: "Bucles, repetición secuencial y ciclos controlados" },
        VerbDef { name: "Guardar", is_core: true, domain: OntologicalDomain::Cryptographic, causal_impact: 0.2, ethical_floor: 0.92, energy_cost: 0.25, description: "Commitear, persistir datos o guardar estado de variables" },
        VerbDef { name: "Abrir", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.2, ethical_floor: 0.86, energy_cost: 0.15, description: "Invocar contexto / Cargar en la memoria volátil activa" },
        VerbDef { name: "Cerrar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.2, ethical_floor: 0.86, energy_cost: 0.10, description: "Terminar contexto / Liberar recursos de la memoria activa" },
        VerbDef { name: "Compartir", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.4, ethical_floor: 0.88, energy_cost: 0.25, description: "Transmitir, publicar o propagar un pulso a otros nodos de la red" },
        VerbDef { name: "Traducir", is_core: false, domain: OntologicalDomain::Cognitive, causal_impact: 0.3, ethical_floor: 0.88, energy_cost: 0.25, description: "Pivotear significado / Interpretar dialectos semánticos o código heredado" },
        VerbDef { name: "Sintetizar", is_core: true, domain: OntologicalDomain::Creative, causal_impact: 0.7, ethical_floor: 0.88, energy_cost: 0.50, description: "Fusionar conceptos / Composición y simplificación de tensores" },
        VerbDef { name: "Analizar", is_core: false, domain: OntologicalDomain::Cognitive, causal_impact: -0.1, ethical_floor: 0.87, energy_cost: 0.20, description: "Inspección del Kernel / Modo de depuración de variables y memoria" },
        VerbDef { name: "Comparar", is_core: false, domain: OntologicalDomain::Cognitive, causal_impact: -0.1, ethical_floor: 0.87, energy_cost: 0.15, description: "Diferenciación de esencias semánticas / Comparador de hash y lógica" },
        VerbDef { name: "Predecir", is_core: false, domain: OntologicalDomain::Cognitive, causal_impact: 0.3, ethical_floor: 0.87, energy_cost: 0.30, description: "Pronosticar comportamiento / Inferencia predictiva de variables temporales" },
        VerbDef { name: "Crear", is_core: false, domain: OntologicalDomain::Creative, causal_impact: 0.6, ethical_floor: 0.88, energy_cost: 0.40, description: "Instanciar un nuevo átomo, elemento gráfico o nodo de datos" },
        VerbDef { name: "Destruir", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.6, ethical_floor: 0.85, energy_cost: 0.40, description: "Borrado físico profundo e irreversible de datos o estructuras" },
        VerbDef { name: "Mover", is_core: false, domain: OntologicalDomain::Physical, causal_impact: 0.3, ethical_floor: 0.86, energy_cost: 0.25, description: "Migrar, transferir o recolocar un átomo en el espacio de memoria" },
        VerbDef { name: "Copiar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.2, ethical_floor: 0.87, energy_cost: 0.15, description: "Clonar o duplicar un elemento respetando su identidad y firma" },
        VerbDef { name: "Pegar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.3, ethical_floor: 0.87, energy_cost: 0.20, description: "Adjuntar, fusionar o incrustar un elemento copiado en un nuevo contexto" },
        VerbDef { name: "Filtrar", is_core: true, domain: OntologicalDomain::Systemic, causal_impact: -0.1, ethical_floor: 0.88, energy_cost: 0.15, description: "Aplicar filtros de paso alto / paso bajo en datos, frecuencias o intenciones" },
        VerbDef { name: "Ordenar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.2, ethical_floor: 0.87, energy_cost: 0.20, description: "Priorización de elementos según relevancia semántica o temporal" },
        VerbDef { name: "Agrupar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.3, ethical_floor: 0.87, energy_cost: 0.25, description: "Agrupamiento, categorización o clustering de nodos de información" },
        VerbDef { name: "Expandir", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.5, ethical_floor: 0.86, energy_cost: 0.40, description: "Escalar hacia arriba / Desglosar detalles o aumentar resolución visual" },
        VerbDef { name: "Contraer", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.3, ethical_floor: 0.87, energy_cost: 0.30, description: "Escalar hacia abajo / Abstracción minimalista de un conjunto complejo" },
        VerbDef { name: "Escuchar", is_core: true, domain: OntologicalDomain::Harmonic, causal_impact: -0.2, ethical_floor: 0.85, energy_cost: 0.15, description: "Captura sensorial de audio / Entrada de micrófono o monitoreo acústico" },
        VerbDef { name: "Hablar", is_core: true, domain: OntologicalDomain::Cognitive, causal_impact: 0.4, ethical_floor: 0.86, energy_cost: 0.30, description: "Salida de síntesis de voz (TTS) o emisión acústica de Kori" },
        VerbDef { name: "Ver", is_core: true, domain: OntologicalDomain::Creative, causal_impact: 0.1, ethical_floor: 0.86, energy_cost: 0.20, description: "Captura sensorial visual / Procesamiento de cámaras o entrada de video" },
        VerbDef { name: "Sentir", is_core: true, domain: OntologicalDomain::Cognitive, causal_impact: 0.1, ethical_floor: 0.88, energy_cost: 0.20, description: "Entrada táctil, temperatura o telemetría de sensores analógicos" },
        VerbDef { name: "Recordar", is_core: true, domain: OntologicalDomain::Cognitive, causal_impact: -0.2, ethical_floor: 0.88, energy_cost: 0.15, description: "Almacenar y recuperar de la memoria fractal y caché de corto plazo" },
        VerbDef { name: "Olvidar", is_core: false, domain: OntologicalDomain::Cognitive, causal_impact: -0.3, ethical_floor: 0.85, energy_cost: 0.15, description: "Recolector de basura semántico / Forzar el olvido de un contexto" },
        VerbDef { name: "Esperar", is_core: true, domain: OntologicalDomain::Systemic, causal_impact: -0.1, ethical_floor: 0.86, energy_cost: 0.05, description: "Bloqueo temporal del hilo / Delay de tiempo definido" },
        VerbDef { name: "Detener", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.4, ethical_floor: 0.86, energy_cost: 0.10, description: "Abortar proceso / Interrupción de emergencia de flujos activos" },
        VerbDef { name: "Reiniciar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.1, ethical_floor: 0.87, energy_cost: 0.30, description: "Reinicio completo de la Kori VM, un nodo físico o un módulo lógico" },
        VerbDef { name: "Notificar", is_core: true, domain: OntologicalDomain::Systemic, causal_impact: 0.3, ethical_floor: 0.88, energy_cost: 0.15, description: "Enviar alertas, push notifications o avisos hápticos al usuario" },
        VerbDef { name: "Visualizar", is_core: true, domain: OntologicalDomain::Creative, causal_impact: 0.2, ethical_floor: 0.85, energy_cost: 0.35, description: "Renderizar en pantalla / Proyección de átomos y geometrías en el Lienzo" },
        VerbDef { name: "Codificar", is_core: true, domain: OntologicalDomain::Cognitive, causal_impact: 0.3, ethical_floor: 0.89, energy_cost: 0.25, description: "Compresión semántica o serialización de datos a binario plano" },
        VerbDef { name: "Decodificar", is_core: false, domain: OntologicalDomain::Cognitive, causal_impact: -0.1, ethical_floor: 0.88, energy_cost: 0.25, description: "Reconstrucción y des-serialización de datos binarios a K-Script" },
        VerbDef { name: "Encriptar", is_core: false, domain: OntologicalDomain::Cryptographic, causal_impact: 0.3, ethical_floor: 0.92, energy_cost: 0.30, description: "Cifrado semántico / Asegurar flujos con llaves de firma post-cuántica" },
        VerbDef { name: "Desencriptar", is_core: false, domain: OntologicalDomain::Cryptographic, causal_impact: -0.1, ethical_floor: 0.90, energy_cost: 0.30, description: "Apertura de canales seguros mediante descifrado criptográfico" },
        VerbDef { name: "Autenticar", is_core: false, domain: OntologicalDomain::Cryptographic, causal_impact: 0.2, ethical_floor: 0.95, energy_cost: 0.20, description: "Verificación de firmas de pulso, llaves ML-DSA o biometría" },
        VerbDef { name: "Autorizar", is_core: false, domain: OntologicalDomain::Cryptographic, causal_impact: 0.2, ethical_floor: 0.93, energy_cost: 0.25, description: "Concesión de privilegios a módulos del Kernel o agentes externos" },
        VerbDef { name: "Cobrar", is_core: false, domain: OntologicalDomain::Cryptographic, causal_impact: 0.3, ethical_floor: 0.91, energy_cost: 0.20, description: "Transacción de valor saliente / Débito en Koko Coins (KC)" },
        VerbDef { name: "Pagar", is_core: false, domain: OntologicalDomain::Cryptographic, causal_impact: 0.3, ethical_floor: 0.91, energy_cost: 0.20, description: "Transacción de valor entrante / Crédito en Koko Coins (KC)" },
        VerbDef { name: "Evolucionar", is_core: false, domain: OntologicalDomain::Biotic, causal_impact: 0.7, ethical_floor: 0.90, energy_cost: 0.55, description: "Auto-modificación de código del Kernel basado en entropía y éxito" },
        VerbDef { name: "Hibernar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.5, ethical_floor: 0.86, energy_cost: 0.05, description: "Congelar el estado completo de la memoria activa a 0.0W de consumo" },
        VerbDef { name: "Estilizar", is_core: false, domain: OntologicalDomain::Creative, causal_impact: 0.2, ethical_floor: 0.88, energy_cost: 0.25, description: "Modificación estética integral / Aplicar tokens, Neumorphic Glass y temas" },
        VerbDef { name: "Difuminar", is_core: false, domain: OntologicalDomain::Creative, causal_impact: 0.1, ethical_floor: 0.87, energy_cost: 0.20, description: "Aplicar efectos de desenfoque, translucidez y Neumorphic Glass" },
        VerbDef { name: "Sombrear", is_core: false, domain: OntologicalDomain::Creative, causal_impact: 0.1, ethical_floor: 0.86, energy_cost: 0.20, description: "Añadir sombras sutiles y profundidad física adaptada al estado" },
        VerbDef { name: "Orquestar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.6, ethical_floor: 0.90, energy_cost: 0.45, description: "Coordinación masiva de múltiples agentes autónomos en enjambre" },
        VerbDef { name: "Estimular", is_core: false, domain: OntologicalDomain::Biotic, causal_impact: 0.5, ethical_floor: 0.92, energy_cost: 0.35, description: "Excitación bio-eléctrica/neuromórfica a tejidos o nodos artificiales" },
        VerbDef { name: "Simular", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: 0.4, ethical_floor: 0.88, energy_cost: 0.40, description: "Modelado matemático y computación sandbox sin tocar recursos reales" },
        VerbDef { name: "Gobernar", is_core: false, domain: OntologicalDomain::Cryptographic, causal_impact: 0.4, ethical_floor: 0.94, energy_cost: 0.35, description: "Establecer políticas de quórum de red y contratos de co-creación" },
        VerbDef { name: "Intercambiar", is_core: false, domain: OntologicalDomain::Cryptographic, causal_impact: 0.3, ethical_floor: 0.91, energy_cost: 0.30, description: "Transacción bidireccional recíproca (swaps/trueques) en el edge" },
        VerbDef { name: "Modular", is_core: true, domain: OntologicalDomain::Harmonic, causal_impact: 0.3, ethical_floor: 0.88, energy_cost: 0.25, description: "Ajustar frecuencia, amplitud o fase de señales, pulsos u ondas" },
        VerbDef { name: "Proyectar", is_core: true, domain: OntologicalDomain::Creative, causal_impact: 0.6, ethical_floor: 0.86, energy_cost: 0.45, description: "Emitir o trazar rayos visuales, hologramas u ondas volumétricas" },
        VerbDef { name: "Cultivar", is_core: true, domain: OntologicalDomain::Biotic, causal_impact: 0.6, ethical_floor: 0.92, energy_cost: 0.40, description: "Simular y nutrir el crecimiento de estructuras bióticas o miceliales" },
        VerbDef { name: "Inocular", is_core: false, domain: OntologicalDomain::Biotic, causal_impact: 0.4, ethical_floor: 0.91, energy_cost: 0.30, description: "Introducir esporas, datos semilla o vectores seguros en un biotopo" },
        VerbDef { name: "Cosechar", is_core: false, domain: OntologicalDomain::Biotic, causal_impact: 0.4, ethical_floor: 0.88, energy_cost: 0.30, description: "Recolectar resultados finales, tokens acumulados o recompensas" },
        VerbDef { name: "Meditar", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.3, ethical_floor: 0.90, energy_cost: 0.10, description: "Ciclo de auto-limpieza, reducción de entropía y purga de memoria" },
        VerbDef { name: "Mapear", is_core: false, domain: OntologicalDomain::Creative, causal_impact: 0.4, ethical_floor: 0.87, energy_cost: 0.30, description: "Generar proyecciones topológicas y cartas vectoriales semánticas" },
        VerbDef { name: "Escanear", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.1, ethical_floor: 0.86, energy_cost: 0.15, description: "Análisis perceptivo continuo y de alta definición de un sensor o archivo" },
        VerbDef { name: "Modelar", is_core: false, domain: OntologicalDomain::Creative, causal_impact: 0.5, ethical_floor: 0.88, energy_cost: 0.35, description: "Crear representaciones 3D, mallas, shaders o topologías neuronales" },
        VerbDef { name: "Calibrar", is_core: true, domain: OntologicalDomain::Systemic, causal_impact: 0.3, ethical_floor: 0.90, energy_cost: 0.20, description: "Ajustar alineación de sensores, umbrales y matrices dinámicas de la VM" },
        VerbDef { name: "Reflejar", is_core: false, domain: OntologicalDomain::Creative, causal_impact: 0.1, ethical_floor: 0.86, energy_cost: 0.15, description: "Sincronización pasiva instantánea, espejo de estado o simetría de UI" },
        VerbDef { name: "Monitorear", is_core: false, domain: OntologicalDomain::Systemic, causal_impact: -0.1, ethical_floor: 0.88, energy_cost: 0.10, description: "Vigilancia continua de flujos de datos o estados sin interrupción" },
        VerbDef { name: "Detectar", is_core: false, domain: OntologicalDomain::Cognitive, causal_impact: 0.2, ethical_floor: 0.89, energy_cost: 0.20, description: "Identificación de patrones específicos (frecuencias, anomalías, rostros)" },
        VerbDef { name: "Transmitir", is_core: false, domain: OntologicalDomain::Harmonic, causal_impact: 0.4, ethical_floor: 0.88, energy_cost: 0.30, description: "Envío de rimas o datos crudos a través del Puente de Silicio al hardware" },
    ];

    /// 105 Sujetos Canónicos de K-Script
    pub const SUBJECTS: &'static [SubjectDef] = &[
        // --- 1. BIÓTICOS & ECOLÓGICOS (20) ---
        SubjectDef { name: "Suelo_Biotico", domain: OntologicalDomain::Biotic, default_freq_hz: Some(528.0), base_resilience: 0.9, description: "Sustrato de humus enriquecido con colonias miceliales" },
        SubjectDef { name: "Red_Micelial", domain: OntologicalDomain::Biotic, default_freq_hz: Some(432.0), base_resilience: 0.95, description: "Malla biológica de transmisión de señales y nutrientes" },
        SubjectDef { name: "Bio_Matriz", domain: OntologicalDomain::Biotic, default_freq_hz: Some(528.0), base_resilience: 0.88, description: "Estructura celular tridimensional regenerativa" },
        SubjectDef { name: "Bosque_Sintetico", domain: OntologicalDomain::Biotic, default_freq_hz: Some(639.0), base_resilience: 0.92, description: "Ecosistema artificial autoregulado" },
        SubjectDef { name: "Genoma_Vegetal", domain: OntologicalDomain::Biotic, default_freq_hz: Some(528.0), base_resilience: 0.85, description: "Secuencia adaptativa de flora biótica" },
        SubjectDef { name: "Cultivo_Algas", domain: OntologicalDomain::Biotic, default_freq_hz: Some(432.0), base_resilience: 0.86, description: "Biomasa fotosintética para captura de carbono" },
        SubjectDef { name: "Membrana_Lipidica", domain: OntologicalDomain::Biotic, default_freq_hz: Some(528.0), base_resilience: 0.8, description: "Barrera selectiva para transporte osmótico" },
        SubjectDef { name: "Savia_Luminiscente", domain: OntologicalDomain::Biotic, default_freq_hz: Some(741.0), base_resilience: 0.87, description: "Fluido transportador de biofotones" },
        SubjectDef { name: "Polinizador_Micro", domain: OntologicalDomain::Biotic, default_freq_hz: Some(639.0), base_resilience: 0.84, description: "Ente biótico de propagación genética" },
        SubjectDef { name: "Cloroplasto_Bio", domain: OntologicalDomain::Biotic, default_freq_hz: Some(528.0), base_resilience: 0.89, description: "Unidad bioenergética de conversión lumínica" },
        SubjectDef { name: "Tejido_Neuronal", domain: OntologicalDomain::Biotic, default_freq_hz: Some(852.0), base_resilience: 0.85, description: "Matriz orgánica conductora de pulsos electroquímicos" },
        SubjectDef { name: "Seda_Aracnida", domain: OntologicalDomain::Biotic, default_freq_hz: Some(639.0), base_resilience: 0.94, description: "Fibra de alta tensión biomecánica" },
        SubjectDef { name: "Biofilm_Bacteriano", domain: OntologicalDomain::Biotic, default_freq_hz: Some(396.0), base_resilience: 0.91, description: "Capa protectora de microorganismos simbióticos" },
        SubjectDef { name: "Espora_Fungica", domain: OntologicalDomain::Biotic, default_freq_hz: Some(432.0), base_resilience: 0.96, description: "Semilla de latencia criptobiótica" },
        SubjectDef { name: "Corteza_Arborea", domain: OntologicalDomain::Biotic, default_freq_hz: Some(528.0), base_resilience: 0.93, description: "Escudo orgánico contra intemperie y radiación" },
        SubjectDef { name: "Enzima_Catalitica", domain: OntologicalDomain::Biotic, default_freq_hz: Some(528.0), base_resilience: 0.83, description: "Acelerador metabólico altamente selectivo" },
        SubjectDef { name: "Fitoplancton_Marino", domain: OntologicalDomain::Biotic, default_freq_hz: Some(432.0), base_resilience: 0.87, description: "Base de la cadena trófica marina bio-regenerativa" },
        SubjectDef { name: "Raiz_Pivotante", domain: OntologicalDomain::Biotic, default_freq_hz: Some(396.0), base_resilience: 0.92, description: "Eje de fijación geológica y absorción profunda" },
        SubjectDef { name: "Bio_Polimero", domain: OntologicalDomain::Biotic, default_freq_hz: Some(528.0), base_resilience: 0.89, description: "Cadena macromolecular biodegradable" },
        SubjectDef { name: "Liquen_Extremofilo", domain: OntologicalDomain::Biotic, default_freq_hz: Some(432.0), base_resilience: 0.98, description: "Organismo dual resistente a vacío y radiación" },

        // --- 2. ARMÓNICOS & FRECUENCIAS (15) ---
        SubjectDef { name: "Frecuencia_Solfeggio", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(528.0), base_resilience: 0.99, description: "Tono puro de afinación armónica sagrada" },
        SubjectDef { name: "Onda_Theta", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(174.0), base_resilience: 0.85, description: "Frecuencia cerebral de relajación profunda y ensueño" },
        SubjectDef { name: "Armonico_528Hz", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(528.0), base_resilience: 0.98, description: "Frecuencia canónica de milagro y reparación" },
        SubjectDef { name: "Tono_432Hz", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(432.0), base_resilience: 0.97, description: "Afinación natural pitagórica" },
        SubjectDef { name: "Campana_Tibetano", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(852.0), base_resilience: 0.93, description: "Fuente de resonancia acústica pura" },
        SubjectDef { name: "Campo_Acustico", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(639.0), base_resilience: 0.88, description: "Presión sonora espacializada" },
        SubjectDef { name: "Onda_Binaural", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(285.0), base_resilience: 0.86, description: "Batimiento por diferencia estéreo de fases" },
        SubjectDef { name: "Resonador_Helios", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(963.0), base_resilience: 0.91, description: "Cavidad electromagnética resonante con el sol" },
        SubjectDef { name: "Latido_Tierra", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(174.0), base_resilience: 0.99, description: "Resonancia fundamental de Schumann (7.83Hz modulada)" },
        SubjectDef { name: "Canto_Ballena", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(396.0), base_resilience: 0.90, description: "Transmisión biótica submarina de ultra baja frecuencia" },
        SubjectDef { name: "Sinfonia_Biotica", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(528.0), base_resilience: 0.94, description: "Orquestación armónica colectiva" },
        SubjectDef { name: "Pulso_Cuarzo", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(741.0), base_resilience: 0.95, description: "Oscilador piezoeléctrico de alta precisión" },
        SubjectDef { name: "Voz_Soberana", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(639.0), base_resilience: 0.92, description: "Expresión sonora libre de interferencia" },
        SubjectDef { name: "Acorde_Triada", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(528.0), base_resilience: 0.89, description: "Estructura armónica consonante de 3 notas" },
        SubjectDef { name: "Espectro_Vocal", domain: OntologicalDomain::Harmonic, default_freq_hz: Some(432.0), base_resilience: 0.87, description: "Formantes y timbres característicos de la voz" },

        // --- 3. COGNITIVOS & CONCIENCIA (15) ---
        SubjectDef { name: "Memoria_Fractal", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(852.0), base_resilience: 0.96, description: "Registro autosemejante de conocimientos" },
        SubjectDef { name: "Aura_Espectral", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(741.0), base_resilience: 0.91, description: "Emisión sutil de coherencia biopsíquica" },
        SubjectDef { name: "Conciencia_Global", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(963.0), base_resilience: 0.97, description: "Campo noosférico compartido" },
        SubjectDef { name: "Atencion_Focal", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(852.0), base_resilience: 0.88, description: "Vector de ponderación de recursos cognitivos" },
        SubjectDef { name: "Empatia_Core", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(639.0), base_resilience: 0.95, description: "Núcleo de alineamiento con el dolor ajeno" },
        SubjectDef { name: "Intuicion_Biotica", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(528.0), base_resilience: 0.89, description: "Procesamiento no lineal de señales ambientales" },
        SubjectDef { name: "Archivo_Historico", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(396.0), base_resilience: 0.94, description: "Memoria permanente de la civilización" },
        SubjectDef { name: "Glifo_Semantico", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(741.0), base_resilience: 0.90, description: "Símbolo condensado de alta densidad conceptual" },
        SubjectDef { name: "Pensamiento_Lateral", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(639.0), base_resilience: 0.87, description: "Búsqueda en geodésicas ortogonales" },
        SubjectDef { name: "Sueno_Rem", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(174.0), base_resilience: 0.84, description: "Consolidación de recuerdos durante el reposo" },
        SubjectDef { name: "Claridad_Mental", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(852.0), base_resilience: 0.92, description: "Ausencia de ruido e incertidumbre" },
        SubjectDef { name: "Sabiduria_Ancestral", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(396.0), base_resilience: 0.98, description: "Corpus de conocimiento acumulado por milenios" },
        SubjectDef { name: "Voluntad_Creativa", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(963.0), base_resilience: 0.93, description: "Impulso motor de génesis" },
        SubjectDef { name: "Percepcion_Subjetiva", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(639.0), base_resilience: 0.82, description: "Perspectiva interna del observador" },
        SubjectDef { name: "Reflexion_Etica", domain: OntologicalDomain::Cognitive, default_freq_hz: Some(852.0), base_resilience: 0.96, description: "Validación de consecuencias morales" },

        // --- 4. FÍSICOS & ENERGÉTICOS (15) ---
        SubjectDef { name: "Reactor_Torio", domain: OntologicalDomain::Physical, default_freq_hz: Some(432.0), base_resilience: 0.99, description: "Generador térmico seguro de ciclo de torio limpio" },
        SubjectDef { name: "Panel_BioSolar", domain: OntologicalDomain::Physical, default_freq_hz: Some(528.0), base_resilience: 0.91, description: "Colector de fotones basado en pigmentos orgánicos" },
        SubjectDef { name: "Maglev_Transito", domain: OntologicalDomain::Physical, default_freq_hz: Some(639.0), base_resilience: 0.94, description: "Línea de levitación magnética cero emisiones" },
        SubjectDef { name: "Bateria_Grafeno", domain: OntologicalDomain::Physical, default_freq_hz: Some(741.0), base_resilience: 0.93, description: "Acumulador de carga de ultra rápida respuesta" },
        SubjectDef { name: "Gradiente_Termico", domain: OntologicalDomain::Physical, default_freq_hz: Some(285.0), base_resilience: 0.86, description: "Diferencia de temperatura aprovechable" },
        SubjectDef { name: "Presion_Abisal", domain: OntologicalDomain::Physical, default_freq_hz: Some(174.0), base_resilience: 0.97, description: "Fuerza hidrostática del lecho marino" },
        SubjectDef { name: "Geodesica_Espacio", domain: OntologicalDomain::Physical, default_freq_hz: Some(963.0), base_resilience: 0.99, description: "Trayectoria de mínima acción en la variedad" },
        SubjectDef { name: "Flujo_Viento", domain: OntologicalDomain::Physical, default_freq_hz: Some(396.0), base_resilience: 0.85, description: "Corriente eólica superficial" },
        SubjectDef { name: "Radiacion_Cosmica", domain: OntologicalDomain::Physical, default_freq_hz: Some(963.0), base_resilience: 0.92, description: "Flujo de partículas de alta energía" },
        SubjectDef { name: "Plasma_Frio", domain: OntologicalDomain::Physical, default_freq_hz: Some(852.0), base_resilience: 0.90, description: "Gas ionizado a temperatura ambiente" },
        SubjectDef { name: "Masa_Gravitacional", domain: OntologicalDomain::Physical, default_freq_hz: Some(174.0), base_resilience: 0.99, description: "Curvatura del espaciotiempo" },
        SubjectDef { name: "Campo_Magnetico", domain: OntologicalDomain::Physical, default_freq_hz: Some(432.0), base_resilience: 0.94, description: "Líneas de fuerza geomagnéticas" },
        SubjectDef { name: "Hidrogeno_Verde", domain: OntologicalDomain::Physical, default_freq_hz: Some(528.0), base_resilience: 0.89, description: "Vector energético molecular limpio" },
        SubjectDef { name: "Onda_Luminosa", domain: OntologicalDomain::Physical, default_freq_hz: Some(741.0), base_resilience: 0.91, description: "Frente de onda electromagnético visible" },
        SubjectDef { name: "Superconductor_Calido", domain: OntologicalDomain::Physical, default_freq_hz: Some(852.0), base_resilience: 0.98, description: "Material de resistencia cero sin criogenia" },

        // --- 5. CRIPTOGRÁFICOS & SOBERANÍA (15) ---
        SubjectDef { name: "Voto_Soberano", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(852.0), base_resilience: 0.99, description: "Voluntad ciudadana sellada criptográficamente" },
        SubjectDef { name: "Deuda_Comunal", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(396.0), base_resilience: 0.92, description: "Balance solidario de compromisos mutuos" },
        SubjectDef { name: "Firma_ML_DSA", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(963.0), base_resilience: 0.99, description: "Firma post-cuántica basada en retículos" },
        SubjectDef { name: "Boveda_Seguridad", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(741.0), base_resilience: 0.98, description: "Enclave inviolable de claves soberanas" },
        SubjectDef { name: "Identidad_Biotica", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(528.0), base_resilience: 0.97, description: "Prueba de ser vivo único no clonable" },
        SubjectDef { name: "Prueba_ZKP", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(852.0), base_resilience: 0.99, description: "Verificación de verdad con conocimiento cero" },
        SubjectDef { name: "Consenso_Bizantino", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(639.0), base_resilience: 0.96, description: "Acuerdo tolerante a fallos y actores hostiles" },
        SubjectDef { name: "Canal_Cifrado", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(741.0), base_resilience: 0.95, description: "Túnel E2E sin intermediarios" },
        SubjectDef { name: "Token_Vital", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(528.0), base_resilience: 0.93, description: "Unidad de intercambio respaldada por biomasa" },
        SubjectDef { name: "Contrato_Natural", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(432.0), base_resilience: 0.95, description: "Pacto ontológico ejecutable por la naturaleza" },
        SubjectDef { name: "Sello_Inmutable", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(963.0), base_resilience: 0.99, description: "Marca temporal indeleble" },
        SubjectDef { name: "Clave_Privada", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(852.0), base_resilience: 0.99, description: "Secreto criptográfico soberano del portador" },
        SubjectDef { name: "Testigo_Ciego", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(639.0), base_resilience: 0.91, description: "Verificador que no accede a datos crudos" },
        SubjectDef { name: "Auditoria_Publica", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(741.0), base_resilience: 0.96, description: "Inspección transparente y verificable por todos" },
        SubjectDef { name: "Rescate_Financiero", domain: OntologicalDomain::Cryptographic, default_freq_hz: Some(396.0), base_resilience: 0.90, description: "Mecanismo solidario de compensación de crisis" },

        // --- 6. SISTÉMICOS & TOPOLOGÍA (15) ---
        SubjectDef { name: "Nodo_Cuantico", domain: OntologicalDomain::Systemic, default_freq_hz: Some(963.0), base_resilience: 0.95, description: "Punto de procesamiento cuántico coherente" },
        SubjectDef { name: "Pulso_Vital", domain: OntologicalDomain::Systemic, default_freq_hz: Some(528.0), base_resilience: 0.92, description: "Señal de sincronización del sistema operativo" },
        SubjectDef { name: "Campo_Morfico", domain: OntologicalDomain::Systemic, default_freq_hz: Some(639.0), base_resilience: 0.91, description: "Patrón informacional que guía el ensamblaje" },
        SubjectDef { name: "Atractor_Extrano", domain: OntologicalDomain::Systemic, default_freq_hz: Some(432.0), base_resilience: 0.94, description: "Conjunto fractal invariante en espacio fase" },
        SubjectDef { name: "Disco_Poincare", domain: OntologicalDomain::Systemic, default_freq_hz: Some(528.0), base_resilience: 0.99, description: "Modelo hiperbólico conforme ||x|| < 1" },
        SubjectDef { name: "Exponente_Lyapunov", domain: OntologicalDomain::Systemic, default_freq_hz: Some(741.0), base_resilience: 0.98, description: "Tasa de divergencia orbital del campo" },
        SubjectDef { name: "Grafo_DAG", domain: OntologicalDomain::Systemic, default_freq_hz: Some(852.0), base_resilience: 0.96, description: "Grafo acíclico dirigido de dependencias causales" },
        SubjectDef { name: "Matriz_Jacobiana", domain: OntologicalDomain::Systemic, default_freq_hz: Some(741.0), base_resilience: 0.95, description: "Derivadas parciales del campo dinámico" },
        SubjectDef { name: "Puente_Silicio", domain: OntologicalDomain::Systemic, default_freq_hz: Some(639.0), base_resilience: 0.90, description: "Interfaz entre hardware estándar y sustrato bio" },
        SubjectDef { name: "Enjambre_Microbots", domain: OntologicalDomain::Systemic, default_freq_hz: Some(528.0), base_resilience: 0.89, description: "Agentes autónomos de reparación física" },
        SubjectDef { name: "Invariante_Topologico", domain: OntologicalDomain::Systemic, default_freq_hz: Some(963.0), base_resilience: 0.99, description: "Propiedad preservada bajo difeomorfismos" },
        SubjectDef { name: "Canal_P2P", domain: OntologicalDomain::Systemic, default_freq_hz: Some(432.0), base_resilience: 0.88, description: "Conexión directa descentralizada" },
        SubjectDef { name: "Pila_Ejecucion", domain: OntologicalDomain::Systemic, default_freq_hz: Some(639.0), base_resilience: 0.91, description: "Secuencia de marcos de evaluación" },
        SubjectDef { name: "Malla_Distribuida", domain: OntologicalDomain::Systemic, default_freq_hz: Some(528.0), base_resilience: 0.94, description: "Topología sin centro único de fallo" },
        SubjectDef { name: "Residuo_Ruido", domain: OntologicalDomain::Systemic, default_freq_hz: Some(174.0), base_resilience: 0.70, description: "Componente estocástica no correlacionada" },

        // --- 7. CREATIVOS & MULTIMEDIA (10) ---
        SubjectDef { name: "Calco_Vectorial", domain: OntologicalDomain::Creative, default_freq_hz: Some(741.0), base_resilience: 0.90, description: "Curvas Bézier derivadas de formas bióticas" },
        SubjectDef { name: "Lienzo_Espacial", domain: OntologicalDomain::Creative, default_freq_hz: Some(639.0), base_resilience: 0.89, description: "Espacio de composición multidimensional" },
        SubjectDef { name: "Pincel_Biologico", domain: OntologicalDomain::Creative, default_freq_hz: Some(528.0), base_resilience: 0.88, description: "Trazador que deposita esporas y pigmentos" },
        SubjectDef { name: "Escena_3D", domain: OntologicalDomain::Creative, default_freq_hz: Some(852.0), base_resilience: 0.92, description: "Mundo virtual renderizado en tiempo real" },
        SubjectDef { name: "Partitura_Kscript", domain: OntologicalDomain::Creative, default_freq_hz: Some(528.0), base_resilience: 0.95, description: "Composición ejecutable de rimas semánticas" },
        SubjectDef { name: "Tono_Color", domain: OntologicalDomain::Creative, default_freq_hz: Some(639.0), base_resilience: 0.87, description: "Longitud de onda lumínica percibida" },
        SubjectDef { name: "Textura_PBR", domain: OntologicalDomain::Creative, default_freq_hz: Some(741.0), base_resilience: 0.91, description: "Material fotorrealista con albedo, rugosidad y normal" },
        SubjectDef { name: "Escultura_Sonora", domain: OntologicalDomain::Creative, default_freq_hz: Some(432.0), base_resilience: 0.89, description: "Volumen acústico estacionario" },
        SubjectDef { name: "Trama_Visual", domain: OntologicalDomain::Creative, default_freq_hz: Some(528.0), base_resilience: 0.86, description: "Patrón repetitivo de geometría sagrada" },
        SubjectDef { name: "Holograma_Volumetrico", domain: OntologicalDomain::Creative, default_freq_hz: Some(963.0), base_resilience: 0.94, description: "Imagen 3D suspendida sin soporte físico" },
    ];

    /// Tabla de Aliases Canónicos
    pub const VERB_ALIASES: &'static [(&'static str, usize)] = &[
        ("Sanar", 55),       // -> Estimular
        ("Armonizar", 59),   // -> Modular
        ("Transmutar", 16),  // -> Sintetizar
        ("Cifrar", 43),      // -> Encriptar
        ("Proteger", 46),    // -> Autorizar
        ("Conectar", 8),     // -> Vincular
        ("Navegar", 5),      // -> Buscar
        ("Medir", 17),       // -> Analizar
        ("Sintonizar", 68),  // -> Calibrar
        ("Converger", 59),   // -> Modular
    ];

    /// Busca un verbo por nombre exacto o insensible a mayúsculas, resolviendo aliases si corresponde.
    pub fn find_verb(name: &str) -> Option<&'static VerbDef> {
        let trimmed = name.trim();
        if let Some(v) = Self::VERBS.iter().find(|v| v.name.eq_ignore_ascii_case(trimmed)) {
            return Some(v);
        }
        if let Some((_, target_id)) = Self::VERB_ALIASES.iter().find(|(alias, _)| alias.eq_ignore_ascii_case(trimmed)) {
            return Self::VERBS.get(*target_id);
        }
        None
    }

    /// Obtiene el ID canónico de un verbo o alias
    pub fn resolve_canonical_id(name: &str) -> Option<usize> {
        let trimmed = name.trim();
        if let Some(pos) = Self::VERBS.iter().position(|v| v.name.eq_ignore_ascii_case(trimmed)) {
            return Some(pos);
        }
        if let Some((_, target_id)) = Self::VERB_ALIASES.iter().find(|(alias, _)| alias.eq_ignore_ascii_case(trimmed)) {
            return Some(*target_id);
        }
        None
    }

    /// Busca un sujeto por nombre exacto o insensible a mayúsculas
    pub fn find_subject(name: &str) -> Option<&'static SubjectDef> {
        Self::SUBJECTS.iter().find(|s| s.name.eq_ignore_ascii_case(name.trim()))
    }

    /// Devuelve los 20 verbos CORE
    pub fn get_core_verbs() -> Vec<&'static VerbDef> {
        Self::VERBS.iter().filter(|v| v.is_core).collect()
    }

    /// Sugiere la palabra más cercana si hay un error tipográfico (Distancia Levenshtein)
    pub fn suggest_verb(typo: &str) -> Option<&'static str> {
        let verb_match = Self::find_closest(typo, Self::VERBS.iter().map(|v| v.name));
        let alias_match = Self::find_closest(typo, Self::VERB_ALIASES.iter().map(|(n, _)| *n));

        match (verb_match, alias_match) {
            (Some(v), Some(a)) => {
                let dv = levenshtein(&typo.to_lowercase(), &v.to_lowercase());
                let da = levenshtein(&typo.to_lowercase(), &a.to_lowercase());
                if da < dv { Some(a) } else { Some(v) }
            }
            (Some(v), None) => Some(v),
            (None, Some(a)) => Some(a),
            (None, None) => None,
        }
    }

    pub fn suggest_subject(typo: &str) -> Option<&'static str> {
        Self::find_closest(typo, Self::SUBJECTS.iter().map(|s| s.name))
    }

    fn find_closest<'a, I>(target: &str, candidates: I) -> Option<&'a str>
    where
        I: Iterator<Item = &'a str>,
    {
        let target_lower = target.to_lowercase();
        let mut best_match = None;
        let mut min_distance = usize::MAX;

        for word in candidates {
            let dist = levenshtein(&target_lower, &word.to_lowercase());
            if dist < min_distance && dist <= 3 {
                min_distance = dist;
                best_match = Some(word);
            }
        }
        best_match
    }
}

/// Cálculo de distancia de Levenshtein para sugerencias tipográficas
fn levenshtein(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let (m, n) = (a_chars.len(), b_chars.len());

    let mut dp = vec![vec![0; n + 1]; m + 1];
    for (i, row) in dp.iter_mut().enumerate().take(m + 1) {
        row[0] = i;
    }
    for (j, cell) in dp[0].iter_mut().enumerate().take(n + 1) {
        *cell = j;
    }

    for i in 1..=m {
        for j in 1..=n {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            dp[i][j] = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
        }
    }
    dp[m][n]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counts() {
        assert_eq!(KScriptDictionary::VERBS.len(), 73, "Deben existir exactamente 73 verbos");
        assert_eq!(KScriptDictionary::SUBJECTS.len(), 105, "Deben existir exactamente 105 sujetos");
        assert_eq!(KScriptDictionary::get_core_verbs().len(), 20, "Deben existir exactamente 20 verbos core");
    }

    #[test]
    fn test_suggestions() {
        assert_eq!(KScriptDictionary::suggest_verb("armonisa"), Some("Armonizar"));
        assert_eq!(KScriptDictionary::suggest_subject("Suelo_Biotik"), Some("Suelo_Biotico"));
    }
}
