// worker.js
try {
    importScripts("./pyodide_engine/pyodide.js"); 
} catch (e) {
    postMessage({ type: "ERROR", error: "404: Pyodide not found." });
}

let pyodideEngine = null;

async function loadPyodideEngine() {
    try {
        pyodideEngine = await loadPyodide({ indexURL: "./pyodide_engine/" });
        postMessage({ type: "READY" });
    } catch (err) {
        postMessage({ type: "ERROR", error: "Boot Failed: " + err.message });
    }
}
loadPyodideEngine();

self.onmessage = async (event) => {
    const { userCode } = event.data;

    if (!pyodideEngine) {
        postMessage({ type: "ERROR", error: "Engine booting..." });
        return;
    }

    const analysisScript = `
import sys
import time
import io
import json

MAX_OUTPUT_CHARS = 50000
output_capture = io.StringIO()
sys.stdout = output_capture

input_counter = 0
def automated_input(prompt=""):
    global input_counter
    input_counter += 1
    if input_counter > 50: return "End"
    return "Rock"

start_time = time.time()
error_msg = ""
final_ops = 0

try:
    sys.setrecursionlimit(5000)
    exec_globals = {
        'input': automated_input,
        '__name__': '__main__'
    }
    
    # Execute the JS-instrumented code directly
    exec(${JSON.stringify(userCode)}, exec_globals)
    
    # Retrieve the dynamically tracked operations from the dictionary
    if '__tracker' in exec_globals:
        final_ops = exec_globals['__tracker']['ops']

except Exception as e:
    error_msg = str(e)
finally:
    end_time = time.time()

sys.stdout = sys.__stdout__

result = {
    "output": output_capture.getvalue()[:MAX_OUTPUT_CHARS],
    "error": error_msg,
    "ops": final_ops, 
    "memory_peak_bytes": 0, # Placeholder until Proxy Objects are implemented
    "duration_sec": end_time - start_time
}
json.dumps(result)
`;

    try {
        let rawResult = await pyodideEngine.runPythonAsync(analysisScript); 
        postMessage({ type: "RESULT", data: JSON.parse(rawResult) });
    } catch (err) {
        postMessage({ type: "ERROR", error: "CRITICAL FAILURE: " + err.toString() });
    }
};