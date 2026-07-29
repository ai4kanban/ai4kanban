// Español — mirrors `en.ts` key for key. See that file for the inline markup
// rules (`code`, **bold**, *italic*, \n).
//
// Product names (AI4Kanban, Claude Code, GitHub Issues, Hermes Agent Kanban,
// Vibe Kanban), file names, track names and shell commands stay as they are.
import type { SiteCopy } from "./types";

const es: SiteCopy = {
  shared: {
    nav: {
      install: "Instalar",
      usage: "Cómo se usa",
      boardUi: "Tablero web",
      features: "Funciones",
      recipes: "Recetas",
      compare: "Comparativas",
      compareMore: "Pronto habrá más comparativas…",
      github: "GitHub ↗",
    },
    footer: {
      license: "Licencia Apache 2.0",
      origin: "Generalizado a partir de una skill hecha para",
    },
    code: {
      copy: "Copiar",
      copied: "Copiado",
      copyAria: "Copiar al portapapeles",
      copiedAria: "Copiado",
    },
    language: { label: "Idioma" },
    vs: "vs",
    bottomLine: "En resumen",
    cta: { install: "Instalar ai4kanban", github: "Ver en GitHub ↗" },
  },

  home: {
    meta: {
      title: "AI4Kanban — gestión de proyectos con IA que crece contigo",
      description:
        "Gestión de proyectos con IA para Claude Code. Dale una idea vaga: el agente la descompone y la va aclarando en bucle hasta que está lista para construir. Markdown plano, en git.",
      social:
        "Dale una idea vaga. El agente la descompone, resuelve por su cuenta lo que puede y te pregunta el resto, y sigue trabajándola en segundo plano hasta que cada detalle está claro para construir.",
    },
    hero: {
      badge: "Una skill de Claude Code",
      title: "Gestión de proyectos con IA\nque crece contigo.",
      lead: "Dale una idea vaga. El agente la descompone, resuelve por su cuenta lo que puede y te pregunta el resto, y sigue trabajándola en segundo plano hasta que cada detalle está claro para construir. El tablero es Markdown plano en `docs/kanban/`: en git, sin base de datos, sin MCP.",
      ctaInstall: "Instálalo con un solo prompt",
      ctaGithub: "Ver en GitHub",
    },
    quickview: {
      caption:
        "El tablero, dibujado en tu terminal: los mismos archivos que viven en git.",
      taskView: "Nombres de tarea",
      fileView: "Rutas de archivo",
      frontAria: "Vista de {view} (delante)",
      flipAria: "Cambiar a la vista de {view}",
    },
    features: {
      breakDown: {
        title: "Descompone el trabajo",
        body: "El agente lee una idea y la parte en subtareas. Si viene enredada con una petición ajena, la separa en una tarea propia.",
      },
      clarify: {
        title: "Aclara en bucle",
        body: "El agente empieza cuestionando la idea. Lo que puede resolver con memoria y sentido común lo resuelve solo; el resto te llega a ti. Y sigue dando vueltas hasta quedarse sin preguntas.",
      },
      alwaysOn: {
        title: "Trabaja 24/7",
        body: "La descomposición y las aclaraciones siguen corriendo en segundo plano hasta que la idea se convierte en una especificación clara.",
      },
      traceable: {
        title: "Cada decisión es rastreable",
        body: "Siempre puedes ver cómo se fue formando una especificación, paso a paso.",
      },
      proposes: {
        title: "Propone tareas por su cuenta",
        body: "El agente plantea funciones sacadas de la memoria de cada módulo. Vetas una y queda registrado: no volverá a proponer nada de ese estilo.",
      },
      selfEvolving: {
        title: "Se va afinando solo",
        body: "Cada vez que intervienes, esa decisión queda registrada y guía lo que el agente decide después. La memoria está organizada por módulo del proyecto.",
      },
      orders: {
        title: "Ordena el trabajo",
        body: "No solo parte tareas: detecta dependencias y pesa el retorno frente al esfuerzo, para que el trabajo avance en el orden correcto.",
      },
      lifecycle: {
        title: "Se ocupa de todo el ciclo",
        body: "Su trabajo no acaba cuando la especificación está clara. Lleva la vida entera de una tarea, desde que se propone hasta que se aclara, se construye y se archiva, así que el tablero siempre refleja dónde está el proyecto de verdad.",
      },
    },
    featuresNote:
      "AI4Kanban está hecho para equipos pequeños. Los agentes de código de hoy ya convierten una especificación clara en código que funciona, pero dales una idea vaga y construirán lo que no era sobre suposiciones equivocadas. AI4Kanban recuerda tus decisiones anteriores y se apoya en ellas para convertir esa misma idea vaga en una especificación lo bastante concreta como para construirla.",
    install: {
      heading: { eyebrow: "Puesta en marcha", title: "Instálalo con un solo prompt" },
      lead: "Desde la raíz de tu proyecto, dile a Claude Code (o a cualquier agente que pueda ejecutar comandos de shell):",
      note: "El agente copia la skill en `.claude/skills/kanban/`, lee tu código para rellenar la configuración, monta el tablero y te propone tus tres primeras tareas.",
    },
    board: {
      heading: { eyebrow: "Uso", title: "Usar AI4Kanban dentro de Claude Code" },
      lead: "Una vez instalado, lo manejas hablando normal:",
      terminal: "you › claude",
      rows: {
        whatsNext: {
          say: '"/kanban ¿qué toca ahora?"',
          does: "lee el tablero y tus fuentes, y propone 3 tareas nuevas",
        },
        addTask: {
          say: '"/kanban añade una tarea: …"',
          does: "revisa la idea, escribe una tarjeta y la añade al índice",
        },
        refine: {
          say: '"/kanban refine #4"',
          does: "revisa la tarjeta #4 y la empuja una etapa hacia lo concreto",
        },
        review: {
          say: '"/kanban revisa el tablero"',
          does: "comprueba claridad, duplicados y tarjetas ya terminadas",
        },
        done: {
          say: '"/kanban #4 está hecha"',
          does: "la comprime en el archivo y elimina la tarjeta",
        },
        badIdea: {
          say: '"/kanban #4 era mala idea"',
          does: "anota el motivo en rejected.md para no volver a proponerla",
        },
      },
    },
    ui: {
      heading: {
        eyebrow: "Tablero web",
        title: "Un tablero local que abres en el navegador",
      },
      lead: "¿Prefieres mirar en vez de preguntar? Un comando abre un tablero sobre esos mismos archivos Markdown: lees una tarea entera sin buscar su archivo en el árbol del IDE, y actúas con un clic en lugar de reescribir el mismo prompt en el chat.",
      optional:
        "Es opcional: la instalación no trae nada extra. Cuando lo quieras, solo pídeselo a Claude:",
      started:
        "Claude arranca el servidor ya compilado por ti: solo en localhost, nada que compilar.",
      actionsLead:
        "Los botones de cada tarjeta le pasan un movimiento al agente, sin escribir nada:",
      actions: {
        implement: {
          label: "Implementar",
          body: "pásale la tarjeta a Claude para que la construya",
        },
        edit: { label: "Editar", body: "retoca la tarjeta, no la ejecutes" },
        refine: { label: "Refinar", body: "empuja un paso una tarjeta atascada" },
        resolve: {
          label: "Resolver",
          body: "responde las preguntas abiertas de la tarjeta",
        },
        archive: { label: "Archivar", body: "guarda una tarjeta terminada" },
        reject: { label: "Rechazar", body: "descarta una tarjeta y anota por qué" },
      },
      shots: {
        board: {
          label: "Vista de tablero",
          alt: "El tablero web local de ai4kanban, con columnas Blockers, UI, Skill, Docs y Distribution llenas de tarjetas Markdown, sus #id, insignias de prioridad y ROI, y barras de progreso de subtareas.",
        },
        detail: {
          label: "Detalle de tarjeta",
          alt: "Página de detalle de una tarea en el tablero local: título, acciones Implementar / Revisar / Editar / Rechazar, una fila de metadatos con vía, prioridad, ROI, pendientes y bloqueos, y el cuerpo completo de la tarjeta.",
        },
      },
      frontAria: "{view} (delante)",
      flipAria: "Cambiar a {view}",
    },
    presets: {
      heading: { eyebrow: "Presets", title: "El preset indie-hacker" },
      lead: "Construir todo el día mientras nadie mira es la trampa clásica del fundador en solitario. Este preset reparte tu tiempo en tres partes: buscar usuarios, comprobar demanda y construir. Claude mantiene el trabajo nuevo repartido entre las tres en lugar de amontonarlo en una.",
      tracks: {
        growth: {
          body: "Ponte delante de los usuarios: publicaciones, contacto directo, lanzamientos. Claude sugiere métodos que vale la pena probar y te los redacta.",
        },
        validation: {
          body: "Comprueba que el mercado lo quiere antes de construir a fondo. Lanza una pregunta honesta, comparte una prueba, guarda el veredicto.",
        },
        building: {
          body: "Quédate en el MVP. Construye cuando escale tu trabajo, refuerce el producto o los usuarios lo pidan claramente.",
        },
      },
      note: "El preset `indie-hacker` añade además dos filtros de revisión, una prueba de foso y una prueba de confianza, y un método de validación de mercado para publicar en Reddit o X antes de construir. En la instalación puedes cambiar las vías y los pesos por los tuyos.",
    },
    advanced: {
      heading: {
        eyebrow: "Funciones",
        title: "Gestión de proyectos en Markdown, no una lista plana",
      },
      lead: "Una lista de tareas plana no es más que eso: una lista. Esta hace cuatro cosas que una lista no puede: trabajo recurrente, subtareas para lo grande, memoria de lo hecho y una cuenta de rendimiento.",
      recurring: {
        title: "Tareas recurrentes",
        body: "Hay trabajo que nunca se hace una sola vez. Guarda cada uno como tarjeta en `docs/kanban/todo/recurring/` (un trabajo que no se archiva nunca) y deja que el `/loop` de Claude Code lo ejecute con la cadencia que elijas, por ejemplo cada mañana.",
        examples: {
          competitors: {
            label: "Seguimiento de competencia",
            body: "Mira qué lanzaron o cambiaron los rivales y marca lo que merezca respuesta.",
          },
          listening: {
            label: "Escucha social",
            body: "Trae publicaciones recientes de Reddit o Slack y saca a flote las que importan.",
          },
          boardReview: {
            label: "Revisión del tablero",
            body: "Barre el backlog buscando tarjetas caducadas, duplicadas o ya hechas.",
          },
        },
        ladderLead:
          "No todo trabajo necesita el mismo nivel de automatización. Una tarjeta puede quedarse en cualquier peldaño: desde uno que llevas a mano, a uno que Claude hace por ti, a un script que corre solo:",
        ladder: {
          ask: { label: "lo haces tú a mano" },
          agent: { label: "Claude lo hace por ti" },
          script: { label: "lo ejecuta un comando, sin humanos" },
        },
        ladderNote:
          "Sube cada trabajo tan arriba como se gane: algunos se quedan en manual, otros acaban corriendo solos.",
      },
      group: {
        title: "Tareas de grupo",
        body: "Una tarea demasiado grande para empezar suele quedarse ahí parada. Cuando no cabe en una tarjeta, se convierte en una **tarea de grupo**: su propia carpeta con un `root.md` de seguimiento y una tarjeta por pieza. Cada pieza tiene su propio id y se conecta con enlaces *Blocked by* y *Related*, así siempre sabes qué toca coger después.",
      },
      memory: {
        title: "Memoria del proyecto",
        body: "Trabajar el tablero es un bucle. En cada vuelta Claude propone trabajo nuevo tirando de tres fuentes, tú decides, y él pliega el resultado en un centro de memoria, de forma que la vuelta siguiente parte de la anterior en vez de repetirla.",
        hubLabel: "docs/kanban/: el centro que guarda tus decisiones",
        files: {
          memory: {
            body: "Las notas de cada barrido pasan al siguiente, con una marca de agua por fuente, así que solo relee lo que ha cambiado.",
          },
          archive: {
            body: "El trabajo entregado se encoge a una línea. Lee esto antes de proponer, así no vuelve a sugerir lo que ya está hecho.",
          },
          rejected: {
            body: "Las ideas que descartaste se guardan con su motivo, así no vuelve a plantearlas nunca.",
          },
          redesign: {
            body: "Un error de diseño que corregiste se convierte en una nota, así la siguiente tarjeta no repite el plan equivocado.",
          },
        },
        loop: {
          aria: "El bucle: propone, luego decides tú, luego aprende, y vuelve a empezar.",
          centerCaption: "lee y escribe",
          stepLabel: "paso",
          stages: {
            propose: {
              label: "Propone",
              body: "Tira de tres fuentes buscando trabajo que no esté ya entregado ni aparcado:",
            },
            decide: {
              label: "Decides tú",
              body: "Adelante, sáltalo o corrige el plan. Con unas palabras a Claude basta.",
            },
            learn: {
              label: "Aprende",
              body: "Pliega el resultado y tu opinión en el centro, así la vuelta siguiente arranca más afinada.",
            },
          },
          sources: {
            project: {
              label: "Tu proyecto",
              body: "Código, tablero, documentación, chat del equipo: conecta lo que ya hay en trabajo que merece la pena.",
            },
            outside: {
              label: "El exterior",
              body: "Reddit, Slack, tu CRM. Los trabajos recurrentes traen señal fresca y dejan los hallazgos en el tablero.",
            },
            you: {
              label: "Tú",
              body: "Tu propio criterio y tus comentarios, guardados en el tablero para que una buena decisión no se pierda ni se pregunte dos veces.",
            },
          },
        },
      },
      metrics: {
        title: "Métricas de tareas",
        body: "Cada tarjeta archivada es una unidad entregada, así que tu velocidad es un número más en git, junto al trabajo: sin ninguna herramienta externa que mantener sincronizada.",
        chart: {
          aria: "Rendimiento diario a lo largo de doce días: tareas totales, completadas, creadas y rechazadas.",
          series: {
            total: "Total",
            completed: "Completadas",
            created: "Creadas",
            rejected: "Rechazadas",
          },
          caption:
            "Una fila por día en `metrics.csv`: completadas, creadas, rechazadas y su total. El script lo mantiene al día; tú no lo tocas nunca.",
        },
      },
    },
  },

  vsGithub: {
    meta: {
      title:
        "AI4Kanban vs. GitHub Issues — otra herramienta para otro trabajo",
      socialTitle: "AI4Kanban vs. GitHub Issues",
      description:
        "Cómo se compara el tablero de archivos de ai4kanban con GitHub Issues: Markdown local frente a una API remota, coste en tokens, ergonomía para el agente, equipos y cuándo usar cada uno.",
      social:
        "No es un sustituto: es otra herramienta para otro cuello de botella. Un cara a cara sobre velocidad, tokens, agentes y equipos.",
    },
    hero: {
      badge: "Comparativa",
      title: "AI4Kanban vs.\nGitHub Issues",
      lead: "No es un sustituto: es otra herramienta para otro cuello de botella. GitHub Issues es un registro compartido, duradero y público. ai4kanban es una superficie de trabajo privada, local y pensada para el agente. Elige según lo que de verdad te esté frenando.",
      ours: {
        name: "AI4Kanban",
        body: "Markdown plano en tu repo. El borrador local rápido del agente.",
      },
      theirs: {
        name: "GitHub Issues",
        body: "Una base de datos detrás de una API. El registro compartido y público.",
      },
    },
    summary: {
      heading: {
        eyebrow: "La versión corta",
        title: "¿Y por qué no usar GitHub Issues sin más?",
      },
      lead: "Puedes. Casi todo lo que hace ai4kanban podrías hacerlo con GitHub Issues más la CLI `gh` o un servidor MCP de GitHub. La diferencia es lo que cuesta llegar ahí.",
      panel:
        "La misma tarea en GitHub Issues significa **más ruido**, **más idas y venidas**, **más tokens**, **más latencia** y **más insistencia en el prompt** para que el agente se digne a usarlo. ai4kanban cambia el alcance de GitHub por velocidad local, y para quien construye solo con un agente, lo que suele escasear es justo la velocidad.",
    },
    comparison: {
      heading: { eyebrow: "Cara a cara", title: "AI4Kanban vs. GitHub Issues" },
      lead: "Catorce dimensiones. Un {check} es una victoria clara; un **guion** es un compromiso deliberado que depende de lo que necesites. ai4kanban se lleva las filas de **velocidad y localidad**; GitHub Issues, las de **escala y colaboración**.",
      ourLabel: "AI4Kanban",
      theirLabel: "GitHub Issues",
      rows: {
        storage: {
          dimension: "Almacenamiento",
          kanban: "Markdown plano en tu repo, en git.",
          issues: "La base de datos de GitHub, detrás de una API.",
        },
        offline: {
          dimension: "Funciona sin conexión",
          kanban: "Sí: son archivos en disco y ya está.",
          issues: "No: necesita red y autenticación.",
        },
        agentReads: {
          dimension: "Cómo lo lee un agente",
          kanban: "Herramientas nativas de archivos: Read, Grep, Glob.",
          issues: "Idas y vueltas por la CLI gh o por MCP.",
        },
        tokenCost: {
          dimension: "Coste en tokens por consulta",
          kanban: "Bajo: grep devuelve solo las líneas que coinciden.",
          issues: "Alto: cargas JSON y esquemas de herramientas.",
        },
        latency: {
          dimension: "Latencia",
          kanban: "Disco local, prácticamente instantáneo.",
          issues: "Un viaje de red por llamada.",
        },
        setup: {
          dimension: "Puesta en marcha",
          kanban: "Un prompt: un archivo de skill y un script pequeño.",
          issues: "Cuenta, token de autenticación, configuración de MCP.",
        },
        lockIn: {
          dimension: "Dependencia del proveedor",
          kanban: "Ninguna: el tablero viaja con el repo.",
          issues: "Vive en GitHub.",
        },
        metadata: {
          dimension: "Metadatos",
          kanban:
            "Mínimos a propósito: prioridad y esfuerzo, todo lo que necesita quien construye solo.",
          issues:
            "Etiquetas, hitos, asignaciones, proyectos, para coordinar un equipo.",
        },
        concurrency: {
          dimension: "Concurrencia",
          kanban: "Ninguna: los ids chocan si dos personas añaden #1894.",
          issues: "Ids asignados por el servidor, seguros para equipos.",
        },
        history: {
          dimension: "Historial de decisiones",
          kanban:
            "Podado a las decisiones que guían la tarea siguiente: por qué se descartó una idea, qué se entregó. Así el agente propone hacia delante y nunca rehace trabajo hecho o muerto.",
          issues:
            "Se conserva todo el historial de comentarios y ediciones, sin descartar nada.",
        },
        closing: {
          dimension: "Cerrar el trabajo",
          kanban: "Archivas la tarea cuando sus puntos están marcados.",
          issues: "Cierra issues automáticamente desde PRs enlazados y CI.",
        },
        search: {
          dimension: "Búsqueda a escala",
          kanban: "grep: rápido en un tablero pequeño, incómodo según crece.",
          issues: "Búsqueda de texto completo indexada y filtros guardados.",
        },
        contributors: {
          dimension: "Colaboradores externos",
          kanban:
            "Posible, pero solo haciendo commit sobre el Markdown: no hay forma ligera de reportar.",
          issues: "Cualquiera puede abrir, comentar y reaccionar sin hacer commit.",
        },
        transparency: {
          dimension: "Transparencia",
          kanban:
            "Cada tarjeta sigue visible en el repo; solo el centro de memoria se poda a lo esencial.",
          issues: "Público y enlazable, el estándar del código abierto.",
        },
      },
    },
    wins: {
      heading: { eyebrow: "Compromisos", title: "Dónde gana cada uno" },
      lead: "Ninguno es mejor sin más. ai4kanban optimiza para que un agente vaya rápido; GitHub Issues optimiza para que mucha gente siga sincronizada.",
      oursHeading: "AI4Kanban",
      theirsHeading: "GitHub Issues",
      ours: {
        tokenLight: {
          title: "Ligero en tokens e instantáneo",
          body: "Sin MCP y sin red. El agente hace grep sobre Markdown local en vez de paginar una API remota: menos tokens, menos latencia y ninguna autenticación que refrescar a mitad de tarea.",
        },
        agentsUseIt: {
          title: "Los agentes lo usan de verdad",
          body: "A los agentes les cuesta buscar en GitHub Issues; por defecto tiran de las herramientas de sistema de archivos. Un tablero en Markdown los encuentra donde ya están: menos insistencia y menos estados de tarea inventados.",
        },
        offline: {
          title: "Sin conexión y tuyo",
          body: "Archivos planos en git. Funciona en un avión y funciona si GitHub se cae. Sin dependencia de un SaaS y sin ataduras: clonas el repo y el tablero entero se viene contigo.",
        },
        memory: {
          title: "Memoria afinada para proponer",
          body: "Registra las decisiones que guían la tarea siguiente: por qué se descartó una idea, qué se entregó, cuánto falta para la meta. Así el agente propone hacia delante, sin rehacer lo hecho ni resucitar lo que tumbaste.",
        },
      },
      theirs: {
        teams: {
          title: "Hecho para equipos",
          body: "Ids asignados por el servidor, ediciones concurrentes seguras, asignaciones. ai4kanban no tiene base de datos: dos personas pueden crear #1894 a la vez y chocar.",
        },
        transparency: {
          title: "Transparencia y alcance",
          body: "Público y enlazable, con colaboradores externos que abren, comentan y reaccionan. Es el sitio correcto cuando la apertura importa más que la velocidad pura.",
        },
        fullContext: {
          title: "Todo el contexto, para siempre",
          body: "ai4kanban comprime a propósito: una tarjeta archivada se encoge a una línea. En GitHub cada comentario, edición y enlace cruzado sigue intacto.",
        },
        integration: {
          title: "Integración profunda",
          body: "Cierre automático desde PRs, enlaces a commits, tableros de proyecto, etiquetas, hitos y todo un ecosistema de herramientas de terceros con búsqueda indexada a escala.",
        },
      },
    },
    ergonomics: {
      heading: { eyebrow: "El quid", title: "Por qué los agentes prefieren archivos" },
      lead: 'La diferencia real aparece cuando es el agente quien trabaja. Pide lo mismo, **"encuentra mis tareas abiertas de prioridad alta"**, y los dos caminos apenas se parecen.',
      issues: {
        title: "you › agent + GitHub MCP",
        chip: "muchos turnos",
        lines: [
          "encuentra mis issues abiertos de prioridad alta",
          "list_issues(state:open, labels:high)",
          "4,2 KB de JSON — 18 issues, con todos sus campos",
          "paginar, filtrar, resumir…",
          "refresco de auth · cabeceras de límite · reintentos",
        ],
        footer: "varias llamadas · KBs de JSON · red cada vez",
      },
      kanban: {
        title: "you › agent + ai4kanban",
        chip: "un turno",
        lines: [
          "encuentra mis tareas abiertas de prioridad alta",
          'grep -rl "Priority: high" docs/kanban/todo',
          "tres rutas de archivo",
          "listo: una llamada, sin red",
        ],
        footer: "una llamada · unas rutas · todo local",
      },
      note: 'Y se acumula. Cada "¿qué toca ahora?", cada archivado, cada revisión del tablero paga el peaje del viaje de ida y vuelta en GitHub Issues. Y los modelos, si pueden elegir, esquivan calladamente la herramienta remota y se van a los archivos.',
    },
    decision: {
      heading: { eyebrow: "La decisión", title: "¿Cuál deberías usar?" },
      oursHeading: "Tira de ai4kanban cuando",
      theirsHeading: "Tira de GitHub Issues cuando",
      ours: [
        "Trabajas solo, o con una pareja pequeña y de confianza.",
        "Llevas el trabajo a través de un agente en la terminal.",
        "Te importa más avanzar que dejar rastro documental.",
        "Quieres el tablero en git: sin conexión y portátil.",
      ],
      theirs: [
        "Construyes en abierto y la transparencia importa.",
        "Varias personas tocan el backlog a la vez.",
        "Te apoyas en enlaces a PR/CI, tableros de proyecto e hitos.",
        "Necesitas que colaboradores externos reporten y debatan.",
      ],
      verdict:
        "En realidad no compiten. GitHub Issues es el **registro compartido**; ai4kanban es el **borrador local rápido del agente**. Si tu cuello de botella es coordinar personas, usa GitHub Issues. Si es el rendimiento con un agente, usa ai4kanban.",
      note: "Mucha gente que construye en solitario usa los dos: GitHub Issues como el rastreador público y ai4kanban como la superficie privada que su agente maneja a diario.",
    },
  },

  vsHermes: {
    meta: {
      title:
        "AI4Kanban vs. Hermes Agent Kanban — un tablero de archivos ligero frente a un runtime duradero",
      socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
      description:
        "Cómo se compara el tablero de archivos de ai4kanban con Hermes Agent Kanban, de Nous Research: dos tableros kanban para agentes que se solapan mucho, uno hecho de archivos planos y diffables que corren en cualquier agente (incluso Hermes), y otro que es una cola SQLite duradera y compartida de la que muchos agentes con nombre toman tareas.",
      social:
        "Dos tableros kanban para agentes que se solapan mucho. ai4kanban es un tablero ligero de archivos que corre en cualquier agente (incluso Hermes); Hermes empaqueta el mismo tablero con una cola duradera y compartida por muchos agentes con nombre.",
    },
    hero: {
      badge: "Comparativa",
      title: "AI4Kanban vs.\nHermes Agent Kanban",
      lead: "Dos tableros kanban pensados para agentes, con mucho solape. La diferencia está en qué lugar de la pila ocupa el tablero: ai4kanban es una *capa de tablero* ligera sobre la que corres cualquier agente; Hermes Agent Kanban funde ese tablero dentro de su propio runtime.",
      ours: {
        name: "AI4Kanban",
        body: "Un tablero de Markdown plano en tu repo. El runtime, la ejecución e incluso el mantenimiento van encima: cambias de agente y el tablero sigue.",
      },
      theirs: {
        name: "Hermes Agent Kanban",
        body: "El tablero, el despachador y los agentes con nombre son un runtime integrado: duradero y todo incluido, pero el tablero no se separa de Hermes.",
      },
      oursDiagramAlt:
        "El kanban es un tablero Markdown en la base; el runtime del agente, la ejecución y el mantenimiento son una capa intercambiable apilada encima.",
      theirsDiagramAlt:
        "Un runtime de Hermes integrado, con el tablero SQLite, el despachador y los agentes con nombre fundidos dentro.",
      taskLayer: "capa de tareas · ejecución + mantenimiento",
      boardLayer: "kanban · archivos Markdown (git)",
      runtimeLabel: "Runtime de Hermes",
    },
    summary: {
      heading: {
        eyebrow: "La versión corta",
        title: "¿Y por qué no usar Hermes Kanban sin más?",
      },
      lead: "Buena pregunta: se solapan bastante. Los dos son tableros kanban desde los que un agente planifica y trabaja, así que piensa en ai4kanban como **una alternativa ligera a Hermes Kanban**: la misma idea de tablero, menos el runtime incluido. La diferencia está en lo que hay debajo.",
      oursHeading: "AI4Kanban — un tablero hecho de archivos",
      theirsHeading: "Hermes Kanban — un tablero dentro de un runtime",
      ours: [
        "Markdown plano en tu repo: cada cambio de tarea o de plan es un diff revisable.",
        "Sin infraestructura: nada que instalar, nada que mantener encendido.",
        "La ejecución la pone el entorno que ya usas: Claude Code, Codex, Cursor, incluso Hermes.",
      ],
      theirs: [
        "Una cola SQLite duradera en ~/.hermes/kanban.db, compartida por muchos agentes con nombre y por personas.",
        "Un despachador reparte las tareas listas entre agentes y recupera las ejecuciones caídas.",
        "Atado a la pila Hermes / Nous y a sus herramientas kanban_*.",
      ],
      whenLabel: "Cuándo usar ai4kanban",
      when: "Elige la skill cuando quieras el tablero **versionado junto a tu código**, cuando vayas a quedarte en un entorno que ya ejecutas, o cuando no quieras operar un runtime solo para tener un tablero de tareas. Tira de Hermes Kanban cuando **ya trabajes a fondo con Hermes**: su tablero se enchufa directo al despachador, los perfiles con nombre y el control desde chat que ya tienes montados. Al final los dos son colas duraderas; la de la skill son archivos en git, la de Hermes son filas en SQLite.",
    },
    harness: {
      heading: {
        eyebrow: "Compatibilidad de entornos",
        title: "¿Qué agentes pueden ejecutar el tablero?",
      },
      lead: "La diferencia más clara de todas. El tablero de la skill son archivos planos, así que **cualquier agente capaz de leer un repo puede ejecutarlo**, incluido el propio Hermes. El tablero de Hermes Kanban vive detrás de las herramientas `kanban_*` del runtime, así que solo puede Hermes.",
      oursSub: "cualquier agente que lea archivos",
      theirsSub: "solo Hermes",
      supported: "compatible",
      notSupported: "no compatible",
      note: "…y la fila de la skill sigue y sigue: Windsurf, OpenCode, Gemini CLI, cualquier cosa que lea archivos. Hermes Kanban no deja puerta abierta a otros agentes.",
    },
    comparison: {
      heading: { eyebrow: "Cara a cara", title: "AI4Kanban vs. Hermes Kanban" },
      lead: "Un {check} es una victoria clara; un **guion** es un compromiso. La skill gana en simplicidad y portabilidad, Hermes en la cola compartida y duradera y en escala; el resto queda en empate.",
      ourLabel: "AI4Kanban",
      theirLabel: "Hermes Kanban",
      rows: {
        whatItIs: {
          dimension: "Qué es",
          kanban:
            "Una capa kanban basada en archivos: el tablero es Markdown plano en tu repo.",
          hermes:
            "Una función kanban del runtime de agentes Hermes: un tablero SQLite duradero.",
        },
        infrastructure: {
          dimension: "Infraestructura",
          kanban:
            "Ninguna propia: el tablero son solo archivos Markdown en tu repo.",
          hermes:
            "Un gateway en marcha, una base de datos SQLite y un bucle despachador.",
        },
        whereBoardLives: {
          dimension: "Dónde vive el tablero",
          kanban:
            "En tu repo, bajo control de versiones: cada cambio de tarea o de plan es un diff revisable.",
          hermes:
            "En una base SQLite en ~/.hermes/kanban.db; los cambios van a un registro de eventos, no a diffs.",
        },
        setup: {
          dimension: "Puesta en marcha",
          kanban: "Un prompt: un archivo de skill y un script pequeño.",
          hermes:
            "Instalar el runtime de Hermes, configurar perfiles y levantar el gateway.",
        },
        parallelRuns: {
          dimension: "Ejecuciones paralelas y programadas",
          kanban:
            "Lo lleva tu entorno: Claude Code lanza subagentes en paralelo cuando arrancas algo; los trabajos programados viven en una carpeta recurring/.",
          hermes:
            "Lo lleva el runtime: el despachador coge las tareas listas por su cuenta y lanza un proceso por tarea.",
        },
        crashRecovery: {
          dimension: "Recuperación ante caídas",
          kanban:
            "No hay cola por tarea: una ejecución que muere a medias simplemente se repite en el siguiente ciclo programado.",
          hermes:
            "Una cola duradera recupera sola el trabajo en vuelo: TTL de reserva, latidos, reclamación de reservas caducadas y reintentos.",
        },
        decomposition: {
          dimension: "Descomposición de tareas",
          kanban:
            "Una tarjeta se parte en pendientes y en un grafo de tareas (grupo, bloqueos, relacionadas) con las dependencias resueltas mientras se escribe.",
          hermes:
            "El despachador ejecuta solo un descompositor LLM que abre una tarea en un grafo de subtareas dirigidas a especialistas.",
        },
        reviewMemory: {
          dimension: "Revisión y memoria",
          kanban:
            "La memoria se poda a por-qué-se-rechazó y qué-se-entregó para que el agente proponga hacia delante: curada, no un registro completo.",
          hermes:
            "Guarda un registro de eventos completo, solo de anexado, y el historial de cada intento para auditoría.",
        },
        dashboard: {
          dimension: "Panel gráfico",
          kanban:
            "Un tablero web local donde las acciones de una tarjeta (implementar, revisar, archivar) le pasan el trabajo a un agente.",
          hermes:
            "Un tablero web en vivo con arrastrar y soltar y un panel lateral, además de control desde apps de chat.",
        },
        scale: {
          dimension: "Escala y alcance",
          kanban: "Un tablero individual; grep se vuelve incómodo según crece.",
          hermes:
            "Escala a muchos agentes repartidos en muchos tableros: multiinquilino y con control desde Discord / Slack / correo / SMS.",
        },
      },
    },
    memory: {
      heading: {
        eyebrow: "Memoria vs. auditoría",
        title: "Qué recuerda cada tablero",
      },
      lead: "La diferencia esencial: la memoria de la skill es una **entrada para planificar**, existe para que la propuesta siguiente sea más lista. El registro de Hermes es una **salida de la ejecución**, existe para poder reproducir el pasado.",
      ours: {
        heading: "AI4Kanban",
        verdict: "Recuerda conclusiones, olvida el resto.",
        body: "Cuatro archivos pequeños, **podados a propósito**: `archive.md` (qué se entregó), `rejected.md` (qué descartamos y por qué), `redesign.md` (errores de diseño a no repetir), `memory.md` (lo que aprendieron los barridos anteriores). El agente los lee todos antes de proponer o escribir una tarjeta; el historial completo es cosa de git.",
        q: "¿Por qué la idea X no está en el tablero?",
        a: "Una línea en `rejected.md`: la idea y por qué se descartó. Las ideas muertas siguen muertas.",
      },
      theirs: {
        heading: "Hermes Kanban",
        verdict: "Recuerda cada evento, no resume nada.",
        body: "Cada cambio de estado cae en un **registro de solo anexado**; cada intento conserva su código de salida y toda la salida del proceso. Está hecho para auditar y recuperarse de caídas, no para guiar la idea siguiente.",
        q: "¿Qué pasó con la tarea 42 esta noche?",
        a: "`claimed → crashed → reclaimed → completed`, con los registros de cada intento ahí para leer.",
      },
      note: "La memoria curada hace al agente más listo la próxima vez; el registro de auditoría hace el pasado reconstruible. Ninguno sustituye al otro.",
    },
    autonomy: {
      heading: {
        eyebrow: "Nivel de autonomía",
        title: "¿Cuánta autonomía le das al agente?",
      },
      lead: 'Hermes Kanban promete **"suelta una frase y vete"**, autonomía total. ai4kanban es **asistido por el agente**, y arranca antes que el modo plan: guardas una idea a medio formar en el tablero, `refine` la convierte en requisitos concretos y tú apruebas antes de que se escriba una línea de código.',
      stops: {
        traditional: {
          level: "Sin autonomía",
          term: "Lo lleva la persona",
          heading: "Kanban tradicional",
          detail:
            "Piensas cada tarea y la descompones tú; Trello o Jira solo lo anotan.",
        },
        kanban: {
          level: "Semiautonomía",
          term: "Asistido por el agente",
          heading: "AI4Kanban",
          detail:
            "Cada `refine` escarba en las piezas que faltan y rellena requisitos. Tú revisas antes de que se construya nada.",
        },
        hermes: {
          level: "Autonomía total",
          term: "Suéltalo y olvídate",
          heading: "Hermes Kanban",
          detail:
            "Entra una línea, sale un árbol de tareas: descompuesto y trabajado sin supervisión hasta terminar. El `/goal` de Claude Code hace la misma apuesta.",
        },
      },
      scaleLeft: "Planificas tú todo",
      scaleMiddle: "El agente planifica, tú apruebas",
      scaleRight: "Planifica todo el agente",
      worstCaseLabel: "El peor caso, por nivel",
      worstCaseTheirs:
        "**Suéltalo y olvídate:** un malentendido pequeño al principio se convierte en un árbol entero de tareas equivocadas, construidas y con los tokens ya gastados.",
      worstCaseOurs:
        "**Asistido por el agente:** una tarjeta Markdown equivocada, que pillas al revisarla, antes de que se construya nada.",
      note: "Un refine rellena los pasos que faltan, separa las ideas colaterales en tarjetas propias, marca los pendientes que ya aterrizaron y te deja a ti las decisiones de criterio en forma de preguntas. Cuando no queda ninguna, la tarjeta pasa a **ready**: la lees y la construyes.",
    },
    gui: {
      heading: { eyebrow: "Los paneles", title: "Interfaz gráfica del tablero" },
      lead: "Los dos traen tablero web, pero cumplen papeles distintos. El de la skill es una **superficie de control para tu agente**: las acciones de una tarjeta lanzan ejecuciones. El de Hermes es una **ventana en vivo al despachador**: muestra qué está haciendo la flota ahora mismo.",
      ours: {
        heading: "AI4Kanban — tablero local",
        body: "Un tablero web local sobre los archivos Markdown. Las acciones de una tarjeta (*implementar, revisar, archivar*) le pasan el trabajo a un agente, y ves su registro llegando en directo, con pausas para preguntarte.",
        alt: "El tablero web local de ai4kanban: un tablero claro con columnas Blockers, UI, Skill, Docs y Distribution y un botón para crear tareas.",
      },
      theirs: {
        heading: "Hermes Kanban — vista en vivo del despachador",
        body: "Un tablero en vivo que sigue el registro de eventos: arrastrar y soltar entre columnas, un panel lateral con el historial de ejecuciones e insignias de estado de salida, y el mismo tablero manejable desde Discord, Slack o SMS.",
        alt: "El panel Kanban de Hermes Agent: un tablero oscuro con columnas Triage, Todo, Scheduled y Ready y una barra de orquestación.",
      },
    },
    wins: {
      heading: { eyebrow: "Compromisos", title: "Dónde gana cada uno" },
      lead: "Ninguno es mejor sin más. ai4kanban optimiza para un tablero ligero, hecho de archivos y sin infraestructura propia; Hermes Kanban optimiza para una cola de trabajo duradera y compartida contra la que muchos agentes corren sin supervisión. Las funciones del entorno (ejecuciones paralelas, orquestación, panel) están en ambos lados, así que no se listan aquí.",
      oursHeading: "AI4Kanban",
      theirsHeading: "Hermes Kanban",
      ours: {
        noInfra: {
          title: "Sin infraestructura propia",
          body: "Sin base de datos, sin gateway, sin demonio. Más allá del agente que ya ejecutas, el tablero son archivos Markdown: nada extra que instalar ni mantener vivo, y funciona en un avión.",
        },
        diffable: {
          title: "Archivos que puedes versionar y ver en diff",
          body: "El tablero vive en el repo y viaja con él, bajo el control de versiones que uses. Cada cambio de tarea o de plan es un diff revisable: sin SQLite fuera de tu proyecto, sin registro de eventos que consultar y sin atarte a una pila de agentes concreta.",
        },
        selfPruning: {
          title: "Memoria que se poda sola",
          body: "Registra por qué se descartó una idea y qué se entregó, así el agente propone hacia delante en vez de resucitar trabajo muerto. Solo guarda lo que guía la tarea siguiente, no un registro de auditoría completo.",
        },
        onePrompt: {
          title: "Se instala con un prompt",
          body: "Un archivo de skill y un script pequeño: sin perfiles que configurar ni despachador que afinar. Encuentra a cualquier agente que lea archivos donde ya está, Hermes incluido.",
        },
      },
      theirs: {
        manyAgents: {
          title: "Un tablero, muchos agentes con nombre",
          body: "Un único tablero duradero donde varios agentes con nombre, y personas, toman tareas y se pasan el trabajo. El despachador sondea las tareas listas y lanza el agente asignado a cada una. El tablero de la skill lo lleva el único entorno en el que estés.",
        },
        selfHealing: {
          title: "Cola de tareas que se autorrepara",
          body: "La cola sigue cada tarea a través de las caídas: TTL de reserva, latidos, reclamación de reservas caducadas, reintentos y cortacircuitos. Un proceso puede morir a medias y el tablero recupera la tarea y la reintenta. Los archivos de la skill también son duraderos, pero una ejecución muerta simplemente espera al siguiente ciclo programado.",
        },
        autoDecompose: {
          title: "Descompone tareas automáticamente",
          body: "Sueltas una tarea en bruto y el descompositor LLM del despachador la abre en un grafo de subtareas, cada una dirigida a un agente especialista, sin desglose manual. La skill parte una tarjeta en pendientes y en un grafo de tareas cuidado a mano.",
        },
        fleetReach: {
          title: "Alcance y escala de flota",
          body: "Hecho para muchos agentes repartidos en muchos tableros, multiinquilino y con control desde Discord, Telegram, Slack, correo y SMS. La skill es un tablero individual y austero que se queda en tu repo y tu terminal.",
        },
      },
    },
    decision: {
      heading: { eyebrow: "La decisión", title: "¿Cuál deberías usar?" },
      oursHeading: "Tira de ai4kanban cuando",
      theirsHeading: "Tira de Hermes Kanban cuando",
      ours: [
        "Quieres un tablero de archivos: cada cambio de tarea o de plan es un diff revisable.",
        "No quieres infraestructura propia: archivos planos, sin conexión, portátiles y sin ataduras.",
        "Lo quieres independiente del agente: Claude Code, Cursor, incluso el propio Hermes.",
        "Trabajas solo y valoras un tablero austero por encima de un motor incluido.",
      ],
      theirs: [
        "Ya trabajas a fondo con Hermes: perfiles, gateway y control desde chat ya montados.",
        "Quieres un único tablero duradero que compartan muchos agentes con nombre y también personas.",
        "Quieres una cola que recupere sola las tareas en vuelo tras una caída.",
        "Quieres que el despachador descomponga tareas solo y las dirija a especialistas.",
        "Ejecutas cargas de flota repartidas en muchos tableros y plataformas de chat.",
      ],
      verdict:
        "Se solapan más de lo que sugieren los nombres: los dos son tableros kanban para agentes. La división está en qué viene incluido: ai4kanban es un **tablero de archivos que deja la automatización a tu entorno**; Hermes Agent Kanban es ese mismo tablero **envuelto en una cola de trabajo duradera y compartida**. Si quieres un tablero que compartan muchos agentes y que sobreviva a las caídas, usa Hermes. Si quieres un tablero austero en tu repo que amplías solo cuando hace falta, usa ai4kanban.",
      note: "Hasta pueden convivir: la skill como el sitio ligero donde planificas y podas en git, y Hermes como la cola duradera que ejecuta el trabajo pesado y compartido una vez que has decidido cuál es.",
    },
  },

  vsVibe: {
    meta: {
      title:
        "AI4Kanban vs. Vibe Kanban — un tablero de planificación frente a una cabina de mando",
      socialTitle: "AI4Kanban vs. Vibe Kanban",
      description:
        "Vibe Kanban se apagó cuando Bloop cerró en abril de 2026. Cómo se compara el tablero de archivos de ai4kanban: un tablero de planificación ligero en tu repo frente a una cabina que ejecuta muchos agentes de código en paralelo, y qué se puede rescatar.",
      social:
        "La empresa detrás de Vibe Kanban cerró. Un tablero de planificación en tu repo frente a una cabina de orquestación de agentes: la diferencia honesta y qué se puede rescatar.",
    },
    hero: {
      badge: "Comparativa",
      title: "AI4Kanban vs.\nVibe Kanban",
      lead: "Vibe Kanban es una cabina para ejecutar muchos agentes de código en paralelo, y la empresa que había detrás, Bloop, cerró en abril de 2026. ai4kanban es un tablero de planificación que tu agente edita como archivos planos en tu repo. Resuelven cuellos de botella distintos. Aquí va la diferencia honesta y lo que de verdad se puede rescatar.",
      ours: {
        name: "AI4Kanban",
        body: "Markdown plano en tu repo. Un tablero de planificación que edita tu agente.",
      },
      theirs: {
        name: "Vibe Kanban",
        body: "Una app web local. Una cabina que ejecuta muchos agentes en paralelo.",
      },
    },
    summary: {
      heading: {
        eyebrow: "La versión corta",
        title: "Vibe Kanban cerró: ¿y ahora qué?",
      },
      lead: "Bloop, la empresa detrás de Vibe Kanban, cerró en abril de 2026. Se cancelaron y reembolsaron los planes de pago, se retiraron las funciones en la nube y el proyecto pasó a ser totalmente local. Quedó como código abierto bajo Apache-2.0, pero el repositorio original no ha tenido commits nuevos desde finales de abril de 2026, así que su futuro depende ahora de los forks de la comunidad y no del equipo que lo construyó.",
      panel:
        "Si lo que valorabas de Vibe Kanban era el **tablero**, un sitio tranquilo donde ordenar y afinar el trabajo para tu agente de código, ai4kanban te lo da como archivos planos en git, sin ninguna empresa que pueda cerrar y sin ningún servidor que mantener vivo. Si lo que valorabas era el **motor que ejecuta muchos agentes en paralelo**, aviso: ai4kanban no es eso, y preferimos decírtelo ahora antes que perderte tres secciones más abajo.",
    },
    comparison: {
      heading: { eyebrow: "Cara a cara", title: "AI4Kanban vs. Vibe Kanban" },
      lead: "Diez dimensiones. Un {check} es una victoria clara; un **guion** es un compromiso deliberado que depende de lo que necesites. ai4kanban se lleva las filas de **ligereza y planificación**; Vibe Kanban, las de **agentes en paralelo y revisión**, sus puntos fuertes de verdad, dichos sin rodeos.",
      ourLabel: "AI4Kanban",
      theirLabel: "Vibe Kanban",
      rows: {
        whatFor: {
          dimension: "Para qué sirve",
          kanban:
            "Un tablero de planificación que tu agente edita en el repo: ordena y afina el trabajo.",
          vibe: "Una cabina para ejecutar muchos agentes de código en paralelo y revisar lo que producen.",
        },
        orchestration: {
          dimension: "Orquestación de agentes en paralelo",
          kanban: "Ninguna: llevas un agente; el tablero no ejecuta agentes.",
          vibe: "Su punto fuerte: muchos agentes a la vez, cada uno en un worktree de git aislado.",
        },
        review: {
          dimension: "Revisión de lo que produce el agente",
          kanban: "No es su trabajo: los diffs te los enseña tu entorno.",
          vibe: "Integrada: revisión de diffs en línea, vista previa en vivo y gestión de pull requests.",
        },
        planning: {
          dimension: "Planificación y refinamiento",
          kanban:
            "Un bucle de refine convierte una idea en bruto en una tarea concreta y lista.",
          vibe: "Mínimos: el tablero sobre todo encola y sigue ejecuciones de agentes.",
        },
        onDisk: {
          dimension: "Qué es en disco",
          kanban: "Markdown plano en tu repo, en git.",
          vibe: "Una base de datos SQLite local en un directorio de configuración.",
        },
        runsAs: {
          dimension: "Cómo se ejecuta",
          kanban: "Solo archivos: sin servidor, nada que mantener vivo.",
          vibe: "Una app web local (backend en Rust + interfaz web) que arrancas y dejas corriendo.",
        },
        setup: {
          dimension: "Puesta en marcha",
          kanban: "Un prompt: un archivo de skill y un script pequeño.",
          vibe: "npx vibe-kanban, más cada CLI de agente instalada y con sesión iniciada.",
        },
        whichAgents: {
          dimension: "Qué agentes lo ejecutan",
          kanban:
            "Cualquier agente que pueda leer archivos: Claude Code, Codex, Cursor y más.",
          vibe: "Las CLIs de agente que trae conectadas: Claude Code, Codex, Gemini y otras.",
        },
        lockIn: {
          dimension: "Dependencia del proveedor",
          kanban: "Ninguna: el tablero son archivos que viajan con el repo.",
          vibe: "Apache-2.0 y autoalojable, y sacaron una exportación de datos antes del cierre.",
        },
        maintenance: {
          dimension: "Quién lo mantiene",
          kanban: "Se mantiene activamente.",
          vibe: "Bloop cerró en abril de 2026; el repositorio original lleva parado desde entonces.",
        },
      },
    },
    purpose: {
      heading: {
        eyebrow: "La diferencia de fondo",
        title: "Tablero de planificación vs. cabina de orquestación",
      },
      lead: "Las dos herramientas están en puntos distintos del bucle. Una es donde decides **qué construir**; la otra es donde **ejecutas los agentes que lo construyen**. Confundir una con la otra es la vía directa a la decepción, así que lo decimos claro.",
      ours: {
        name: "AI4Kanban — el plan",
        is: "Un tablero que tu agente lee y edita como Markdown plano en tu repo. Guardas una idea en bruto, un bucle de refine la afina hasta dejarla lista y tú apruebas antes de que se escriba código. El trabajo vive en git, junto al código que va a cambiar.",
        isnt: "No ejecuta agentes, no levanta worktrees ni revisa sus diffs: eso lo hace tu entorno. Es el mapa, no el motor.",
      },
      theirs: {
        name: "Vibe Kanban — el motor",
        is: "Una app web local que ejecuta muchos agentes de código a la vez, cada uno aislado en su propio worktree de git, y luego te deja revisar sus diffs y previsualizar la app en un mismo sitio. Su valor está en el rendimiento de las ejecuciones en paralelo.",
        isnt: "No está hecha para afinar una idea a medio formar hasta convertirla en un plan: el tablero sobre todo encola y sigue ejecuciones. El refinamiento es mínimo.",
      },
      note: "Mucha gente usaba Vibe Kanban solo por el tablero. Si ese eras tú, ai4kanban es una casa más ligera para eso: archivos en git, nada que mantener encendido. Si lo usabas para llevar agentes en paralelo, sigue de cerca los forks de la comunidad; ai4kanban no va a sustituir ese motor.",
    },
    wins: {
      heading: { eyebrow: "Compromisos", title: "Dónde gana cada uno" },
      lead: "Ninguno es mejor sin más. ai4kanban optimiza para un tablero ligero, hecho de archivos, que sobrevive a cualquier herramienta; Vibe Kanban optimiza para ejecutar y revisar muchos agentes a la vez.",
      oursHeading: "AI4Kanban",
      theirsHeading: "Vibe Kanban",
      ours: {
        nothingRunning: {
          title: "Nada que mantener encendido",
          body: "El tablero es Markdown plano en tu repo: sin app web, sin base de datos, sin servidor. Nada que instalar más allá del agente que ya ejecutas, y nada que pueda caerse.",
        },
        planning: {
          title: "Planificar, no solo encolar",
          body: "Un bucle de refine escarba en las piezas que faltan y convierte una idea en bruto en una tarjeta concreta que apruebas antes de que se escriba código. El tablero de Vibe Kanban sobre todo encola ejecuciones de agentes.",
        },
        outlives: {
          title: "Sobrevive a cualquier empresa",
          body: "Sin SaaS, sin runtime incluido, sin un repositorio que pueda pararse. El tablero son archivos en git: clonas el repo y se viene contigo. El cierre de Bloop es exactamente el riesgo que esto evita.",
        },
        anyAgent: {
          title: "Cualquier agente, en cualquier momento",
          body: "Son solo archivos, así que cualquier agente que lea archivos puede llevarlo: Claude Code, Codex, Cursor o a lo que te cambies después. No quedas atado a la lista de CLIs que soporte una herramienta.",
        },
      },
      theirs: {
        parallel: {
          title: "Ejecuta muchos agentes a la vez",
          body: "Su razón de ser entera: repartir el trabajo entre varios agentes de código en paralelo, cada uno aislado en su rama y su worktree de git para que nunca choquen. ai4kanban no ejecuta agentes en absoluto.",
        },
        reviewInPlace: {
          title: "Ejecutar y revisar en un mismo sitio",
          body: "Revisión de diffs en línea, un navegador integrado para previsualizar la app y gestión de pull requests, todo en la cabina. Miras y diriges lo que produce el agente sin salir del tablero.",
        },
        boardUi: {
          title: "Una interfaz de tablero de verdad",
          body: "Un tablero web hecho para lanzar ejecuciones de agentes: arrancas una tarea, la ves trabajar, cambias de espacio de trabajo. Está diseñado para orquestar, no es un archivo plano al que haces grep.",
        },
        support: {
          title: "Soporte amplio de agentes",
          body: "Primeros en llegar a la orquestación multiagente, con muchas CLIs de agente conectadas de fábrica: Claude Code, Codex, Gemini y más.",
        },
      },
    },
    decision: {
      heading: { eyebrow: "La decisión", title: "¿Cuál deberías usar?" },
      oursHeading: "Tira de ai4kanban cuando",
      theirsHeading: "Tira de Vibe Kanban cuando",
      ours: [
        "Quieres un tablero de planificación que tu agente edite dentro del repo.",
        "Quieres cero infraestructura: archivos en git, nada que ejecutar ni mantener vivo.",
        "Prefieres no atar tu tablero a un producto que puede cerrar.",
        "Llevas un agente cada vez y valoras un plan claro por encima del paralelismo.",
      ],
      theirs: [
        "Quieres ejecutar muchos agentes de código en paralelo, cada uno aislado.",
        "Quieres revisión de diffs en línea y vista previa en vivo en una misma cabina.",
        "Orquestar y revisar ejecuciones de agentes es tu cuello de botella real.",
        "No te importa depender de un fork de la comunidad ahora que Bloop ha cerrado.",
      ],
      verdict:
        "Resuelven cuellos de botella distintos. Vibe Kanban es una **cabina de orquestación** para ejecutar muchos agentes; ai4kanban es un **tablero de planificación** que un agente edita en tu repo. Si te encantaba el tablero de Vibe Kanban para ordenar el trabajo, la skill te lo da como archivos planos que sobreviven a cualquier empresa. Si te encantaba su motor de agentes en paralelo, la skill no es eso, y preferimos decirlo.",
      note: "Ahora que Bloop ha cerrado, el tablero es la parte que merece la pena llevarse hacia delante sin ninguna empresa detrás, y eso es exactamente ai4kanban.",
    },
  },
};

export default es;
