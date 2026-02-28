const PROGRAMS = {
  "eth-itet": "BSc Elektro- und Informationstechnologie (ETH)",
  "fhzh-elektrotechnik": "BSc Elektrotechnik (ZHAW)",
  "fhnw-eit": "BSc Elektro- und Informationstechnik (FHNW)",
  "fhzh-cs": "BSc Informatik (ZHAW)",
};

// Queue for sequential loading
let loadQueue = Promise.resolve();
const loadedModules = {};

// Function to load script sequentially
function loadScriptSequentially(programId) {
  // Return a promise that chains onto the queue
  const loadTask = loadQueue.then(async () => {
    if (loadedModules[programId]) return loadedModules[programId];

    // Path is relative to comparison-template.html which is in study-visualization/standard/
    // Data is in study-visualization/program-specific/...
    const scriptPath = `../program-specific/${programId}/data/basic-modules-data.js`;

    // Ensure global is clear
    window.StudiengangModules = undefined;

    try {
      await loadScript(scriptPath);

      const data = window.StudiengangModules;
      if (data) {
        loadedModules[programId] = data;
        window.StudiengangModules = undefined; // Cleanup
        return data;
      } else {
        throw new Error(
          `Keine Daten für ${programId} gefunden (window.StudiengangModules war undefined).`,
        );
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  // Update queue but catch errors so queue doesn't stall
  loadQueue = loadTask.catch(() => {});
  return loadTask;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load failed: ${src}`));
    document.head.appendChild(script);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  populateSelectors();
  // Set defaults
  document.getElementById("prog1").value = "eth-itet";
  document.getElementById("prog2").value = "fhzh-elektrotechnik";
  document.getElementById("prog3").value = "fhzh-cs";

  // Initial load
  updateComparison();
});

function populateSelectors() {
  const selects = ["prog1", "prog2", "prog3"];
  selects.forEach((id) => {
    const select = document.getElementById(id);
    // Clear existing options except first
    while (select.options.length > 1) {
      select.remove(1);
    }

    Object.entries(PROGRAMS).forEach(([key, label]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      select.appendChild(option);
    });
  });
}

async function updateComparison() {
  const prog1 = document.getElementById("prog1").value;
  const prog2 = document.getElementById("prog2").value;
  const prog3 = document.getElementById("prog3").value;

  const selectedPrograms = [prog1, prog2, prog3];

  const container = document.getElementById("comparison-content");

  // Check if any program is selected
  if (!prog1 && !prog2 && !prog3) {
    container.innerHTML =
      '<div style="text-align:center; padding: 20px; color: #666;">Bitte wählen Sie mindestens einen Studiengang aus.</div>';
    return;
  }

  container.innerHTML =
    '<div style="text-align:center; padding: 20px;">Lade Daten...</div>';

  try {
    // Load data - must be careful to handle empty selections
    // Use Promise.all but with sequential loader inside
    const results = await Promise.all(
      selectedPrograms.map((prog) =>
        prog ? loadScriptSequentially(prog) : Promise.resolve(null),
      ),
    );

    renderComparison(results, selectedPrograms);
  } catch (error) {
    console.error("Fehler beim Laden:", error);
    container.innerHTML = `<div style="color:red; text-align:center; padding: 20px;">Fehler beim Laden der Daten: ${error.message}</div>`;
  }
}

function renderComparison(results, programIds) {
  const container = document.getElementById("comparison-content");
  container.innerHTML = "";

  // Helper to get absolute semester
  const getAbsoluteSemester = (mod) => {
    // Some programs use semester 1..6 (FHNW)
    // Others use year 1..3 and semester 1..2 (ETH, ZHAW)

    // If semester is > 2, it is definitely absolute
    if (mod.semester > 2) return mod.semester;

    // If year is defined
    if (mod.year) {
      // If year 1, semester 1 or 2 -> absolute 1 or 2
      if (mod.year === 1) return mod.semester;

      // Logic: if semester <= 2 and year > 1, treat as relative
      // because if it was absolute, for year 2 it would be 3 or 4.
      if (mod.semester <= 2) {
        return (mod.year - 1) * 2 + mod.semester;
      }
    }

    return mod.semester;
  };

  // Calculate max semester
  let maxSemester = 0;
  results.forEach((modules) => {
    if (modules) {
      modules.forEach((m) => {
        const s = getAbsoluteSemester(m);
        if (s > maxSemester) maxSemester = s;
      });
    }
  });

  if (maxSemester === 0 && results.some((r) => r !== null)) {
    maxSemester = 6; // Default fallback
  }

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "20px";

  for (let sem = 1; sem <= maxSemester; sem++) {
    // Semester Section
    const section = document.createElement("div");

    const title = document.createElement("h2");
    title.className = "semester-title";
    title.style.borderBottom = "2px solid #ddd";
    title.style.paddingBottom = "10px";
    title.style.marginBottom = "15px";
    title.textContent = `${sem}. Semester`;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "comparison-grid";

    // Columns
    results.forEach((modules, index) => {
      const progId = programIds[index];
      const col = document.createElement("div");
      col.className = "program-column";

      if (progId && modules) {
        const progName = PROGRAMS[progId];
        col.innerHTML = `<h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px;">${progName}</h3>`;

        const list = document.createElement("div");
        list.className = "modules-list";

        const semModules = modules.filter(
          (m) => getAbsoluteSemester(m) === sem,
        );

        if (semModules.length === 0) {
          list.innerHTML =
            '<div style="color:#999;font-style:italic; padding:10px;">Keine Module in diesem Semester</div>';
        } else {
          semModules.forEach((mod) => {
            const item = document.createElement("div");
            item.className = "module-item";

            // Calculate proportional height
            // Base height for content (padding + text) is roughly 60px
            // Add scaling factor per ECTS
            const pixelPerECTS = 12;
            const baseHeight = 50;
            const minHeight = baseHeight + mod.ects * pixelPerECTS;

            item.style.minHeight = `${minHeight}px`;

            item.style.borderLeft = `4px solid ${getCategoryColor(mod.standardcategory)}`;
            item.style.padding = "10px";
            item.style.marginBottom = "8px";
            item.style.background = "white";
            item.style.borderRadius = "4px";
            item.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
            item.style.display = "flex";
            item.style.flexDirection = "column";
            item.style.justifyContent = "space-between";

            item.innerHTML = `
                            <div style="font-weight:600; margin-bottom:4px;">${mod.name}</div>
                            <div style="font-size:0.85em; color:#666; display:flex; justify-content:space-between; margin-top: auto;">
                                <span>${mod.ects} KP</span>
                                <span style="opacity:0.8; text-align:right;">${mod.standardcategory || ""}</span>
                            </div>
                        `;
            list.appendChild(item);
          });
        }
        col.appendChild(list);
      } else {
        // Empty column placeholder if needed or just empty
        if (programIds.some((p) => p)) {
          // if any other program is active
          col.style.background = "transparent";
          col.style.boxShadow = "none";
        }
      }
      grid.appendChild(col);
    });

    section.appendChild(grid);
    wrapper.appendChild(section);
  }

  container.appendChild(wrapper);
}

function getCategoryColor(category) {
  if (!category) return "#9e9e9e";
  const normalized = category.toLowerCase();
  if (
    normalized.includes("mathematik") ||
    normalized.includes("analysis") ||
    normalized.includes("algebra")
  )
    return "#4a90e2"; // Blue
  if (normalized.includes("physik") || normalized.includes("naturwissenschaft"))
    return "#f5a623"; // Orange
  if (normalized.includes("informatik") || normalized.includes("programmieren"))
    return "#50e3c2"; // Teal
  if (normalized.includes("elektro") || normalized.includes("schaltung"))
    return "#d0021b"; // Red
  if (normalized.includes("projekt") || normalized.includes("praxis"))
    return "#bd10e0"; // Purple
  if (normalized.includes("wirtschaft") || normalized.includes("sozial"))
    return "#9013fe"; // Violet
  if (normalized.includes("signale") || normalized.includes("systeme"))
    return "#7ed321"; // Green
  return "#9e9e9e"; // Grey
}
