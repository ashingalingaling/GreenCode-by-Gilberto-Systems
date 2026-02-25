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

    // Removed ast and tracemalloc completely!
    const analysisScript = `
import sys
import time
import io
import json

MAX_OUTPUT_CHARS = 50000
output_capture = io.StringIO()
sys.stdout = output_capture

# Input Automation
input_counter = 0
def automated_input(prompt=""):
    global input_counter
    input_counter += 1
    if input_counter > 50: return "End"
    return "Rock"

start_time = time.time()
error_msg = ""
final_ops = 0
final_peak_mem = 0

try:
    sys.setrecursionlimit(5000)
    
    proxy_definitions = """
def _update_mem(bytes_added):
    global __tracker
    __tracker['current_mem'] += bytes_added
    if __tracker['current_mem'] > __tracker['peak_mem']:
        __tracker['peak_mem'] = __tracker['current_mem']

class GreenList(list):
    def __init__(self, *args):
        super().__init__(*args)
        # Apply formula: C_base (56) + N_items * C_ptr (8)
        self._size = 56 + (len(self) * 8)
        _update_mem(self._size)
        
    def append(self, item):
        super().append(item)
        _update_mem(8) # Add 8 bytes for new pointer
        
    def pop(self, index=-1):
        if len(self) > 0:
            _update_mem(-8) # Free 8 bytes
        return super().pop(index)
        
    def clear(self):
        freed_bytes = len(self) * 8
        super().clear()
        _update_mem(-freed_bytes)
"""

    # We append the userCode (which contains the JS injected __tracker) 
    # underneath our Proxy setup to ensure everything is initialized correctly.
    full_code = proxy_definitions + "\\n" + ${JSON.stringify(userCode)}
    
    exec_globals = {
        'input': automated_input,
        '__name__': '__main__'
    }
    
    # Execute the combined mathematical script directly
    exec(full_code, exec_globals)
    
    # Retrieve both dynamically tracked metrics
    if '__tracker' in exec_globals:
        final_ops = exec_globals['__tracker'].get('ops', 0)
        final_peak_mem = exec_globals['__tracker'].get('peak_mem', 0)

except Exception as e:
    error_msg = str(e)
finally:
    end_time = time.time()

sys.stdout = sys.__stdout__

result = {
    "output": output_capture.getvalue()[:MAX_OUTPUT_CHARS],
    "error": error_msg,
    "ops": final_ops, 
    "memory_peak_bytes": final_peak_mem, 
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