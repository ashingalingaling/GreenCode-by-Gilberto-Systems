# GreenCode Analyzer

A web-based runtime energy profiling system designed to analyze and visualize the energy consumption of Python algorithms. Built by Group GILBERTO (FEU Institute of Technology), this tool utilizes an Instruction-Level Energy Model (ILEM) to estimate thermodynamic energy (Joules and kWh) without relying on physical hardware sensors.

## Getting Started (How to Run)

Because this system utilizes JavaScript Web Workers to isolate heavy computations and prevent UI freezing, **it cannot be run by simply double-clicking the `index.html` file.** Browsers block Web Workers from running via the `file:///` protocol for security reasons.

To run the GreenCode Analyzer locally, you must serve it through a local web server.

### Prerequisites
1. A modern web browser (Google Chrome recommended for DevTools support).
2. A local web server environment.
3. Supabase project credentials (for saving execution history).

### Installation & Setup
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/GreenCode-by-Gilberto-Systems.git](https://github.com/your-username/GreenCode-by-Gilberto-Systems.git)
   cd GreenCode-by-Gilberto-Systems
   ```

2. **Start a Local Development Server:**
   You can use any local server. Here are two easy methods:
   * **Using Python:** Run `python -m http.server 8000` in your terminal, then open `http://localhost:8000` in your browser.
   * **Using VS Code:** Install the "Live Server" extension, right-click `index.html`, and select "Open with Live Server".

## How to Use (Onboarding)

The GreenCode Analyzer is designed to give you real-time feedback on algorithmic efficiency. 

1. **Input Your Code:** 
   * **Single File:** Paste your Python 3.x script directly into the Live Execution Input editor.
   * **Multi-File Project:** Drag and drop your project folder into the "Drag & Drop Files" zone. The system's Virtual File System (VFS) will automatically mount them and resolve your local `import` statements.
2. **Run Analysis:** Click "Run & Analyze". The system will use a Regex-based Linear Scan to inject operation counters and memory proxies before compiling the code via Pyodide.
3. **Monitor Real-Time Telemetry:** Watch the interactive dashboard visualize your script's Time Complexity (Operation Count) and Space Complexity (Peak Memory Allocation in Bytes).
4. **Evaluate Energy Output:** Review the final estimated energy cost in Joules and kWh, calculated via our deterministic ILEM heuristic formula.
5. **Force Stop:** If evaluating an infinite loop, click the "Force Stop" button to safely terminate the Web Worker thread and save your partial execution telemetry to your history.

##  System Architecture
* **Frontend:** HTML5, CSS (Tailwind), vanilla JavaScript.
* **Execution Engine:** Pyodide (WebAssembly) isolated within Web Workers.
* **Visualization:** Chart.js for real-time telemetry.
* **Backend/Database:** Serverless cloud architecture via Supabase (PostgreSQL) for session logging.

##  Authors
* Lorenzo Gilbert O. Flores
* Arnold Lino B. Cabasag
* Simione Hingano Finau
* John Paul Mathew R. Lacsamana