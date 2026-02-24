// app.js
let energyHistory = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let worker = null;
let energyChart;
let sessionCount = 0;

window.onload = function() {
    setupChart();
    initWorker();
};

function instrumentPythonCodeJS(rawCode) {
    const lines = rawCode.split('\n');
    
    // Use a mutable dictionary to avoid Python scope/global restriction errors
    let instrumentedCode = [
        '__tracker = {"ops": 0}'
    ];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        instrumentedCode.push(line);
        
        // Detect loops or function definitions
        if (line.match(/^\s*(for|while|def)\b.*:/)) {
            let nextLineIndent = "    "; 
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() !== "") {
                    let match = lines[j].match(/^(\s+)/);
                    if (match) {
                        nextLineIndent = match[1];
                    } else {
                        nextLineIndent = line.match(/^(\s*)/)[1] + "    ";
                    }
                    break;
                }
            }
            // Inject dictionary mutation (No global keyword needed!)
            instrumentedCode.push(nextLineIndent + "__tracker['ops'] += 1");
        }
    }
    
    return instrumentedCode.join('\n');
}

function initWorker() {
    if (worker) worker.terminate();
    worker = new Worker('worker.js');

    worker.onmessage = function(e) {
        const { type, data, error } = e.data;

        if (type === "READY") {
            logToTerminal("Analysis Engine Ready.", "SUCCESS");
            setRunButtonState("READY");
            document.getElementById('engineLoader').style.display = 'none';
            document.getElementById('statusIndicator').innerText = "SYSTEM IDLE";
        } 
        else if (type === "RESULT") {
            handleResult(data);
        } 
        else if (type === "ERROR") {
            logToTerminal("Error: " + error, "ERR");
            setRunButtonState("READY");
        }
    };
    
    worker.onerror = function(err) {
        logToTerminal("Worker Crash: " + err.message, "ERR");
        setRunButtonState("READY");
    };
}

function runRealAnalysis() {
    const userCode = document.getElementById('codeInput').value;
    const btn = document.getElementById('runBtn');

    if (btn.innerText === "FORCE STOP") {
        worker.terminate();
        logToTerminal("Execution Terminated by User.", "WARN");
        initWorker(); 
        return;
    }

    energyHistory = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; 
    
    if (energyChart) {
        energyChart.data.datasets[0].data = energyHistory;
        energyChart.update();
    }

    document.getElementById('terminalBody').innerHTML = "";
    
    logToTerminal("Instrumenting Code via JS Lexer...", "INFO");
    const dynamicallyInstrumentedCode = instrumentPythonCodeJS(userCode);

    logToTerminal("Executing in Pyodide Sandbox...", "INFO");
    updateStatus("RUNNING", "text-yellow-300 animate-pulse");
    setRunButtonState("RUNNING");

    worker.postMessage({ userCode: dynamicallyInstrumentedCode });
}

function handleResult(data) {
    if (data.output) logToTerminal(data.output, "SUCCESS");
    if (data.error) logToTerminal("Runtime Exception: " + data.error, "ERR");
    
    calculateManualEnergy(data);
    
    setRunButtonState("READY");
    updateStatus("COMPLETE", "text-emerald-300");
}

function calculateManualEnergy(data) {
    const N_ops = data.ops;                
    const M_peak = data.memory_peak_bytes; 
    const T_exec = data.duration_sec;      

    const C_CPU = 1.5e-9;
    const C_MEM = 2.25e-9;
    const C_BASE = 0.0005;

    const energy_cpu = N_ops * C_CPU;
    const energy_mem = M_peak * T_exec * C_MEM;
    const total_energy = energy_cpu + energy_mem + C_BASE;

    const total_kwh = total_energy / 3600000;

    document.getElementById('totalJoulesDisp').innerHTML = 
        `${total_energy.toFixed(6)} J`;
        
    document.getElementById('opsCount').innerText = N_ops;
    
    recordExecutionData(data, total_energy, total_kwh);
    updateChart(N_ops);
}

function recordExecutionData(data, energy, kwh) {
    sessionCount++;
    const tableBody = document.getElementById('analyticsTableBody');
    const noDataRow = document.getElementById('noDataRow');
    if (noDataRow) noDataRow.remove();

    const timestamp = new Date().toLocaleTimeString('en-GB');

    const newRow = document.createElement('tr');
    newRow.className = "bg-white/50 border border-emerald-50 hover:bg-emerald-50/80 transition-all group";
    
    newRow.innerHTML = `
        <td class="py-4 px-2 text-gray-500 font-bold">#${String(sessionCount).padStart(3, '0')} <span class="block text-[9px] font-normal opacity-60">${timestamp}</span></td>
        <td class="py-4 px-2 font-mono text-blue-700">${data.ops} Ops</td>
        <td class="py-4 px-2 font-mono text-purple-700">${data.memory_peak_bytes} B</td>
        <td class="py-4 px-2 text-center font-black text-emerald-600">${energy.toFixed(6)} J</td>
        <td class="py-4 px-2 text-center font-mono text-gray-600">${kwh.toExponential(3)} kWh</td>
    `;
    tableBody.prepend(newRow);
}

function exportToCSV() {
    let csv = "ID,Timestamp,Ops,Memory(Bytes),Energy(J),Energy(kWh)\n";
    const rows = document.querySelectorAll("#analyticsTableBody tr");
    rows.forEach(row => {
        const cols = row.querySelectorAll("td");
        if (cols.length > 0) {
            const idTime = cols[0].innerText.split('\n');
            const ops = cols[1].innerText.replace(' Ops','');
            const mem = cols[2].innerText.replace(' B','');
            const joules = cols[3].innerText.replace(' J','');
            const kwh = cols[4].innerText.replace(' kWh','');
            
            csv += `${idTime[0]},${idTime[1]},${ops},${mem},${joules},${kwh}\n`;
        }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Gilberto_Physics_Data.csv';
    a.click();
}

function setRunButtonState(state) {
    const btn = document.getElementById('runBtn');
    if (state === "RUNNING") {
        btn.innerText = "FORCE STOP";
        btn.classList.replace('bg-emerald-600', 'bg-red-600');
        btn.classList.replace('hover:bg-emerald-700', 'hover:bg-red-700');
    } else {
        btn.disabled = false;
        btn.innerText = "RUN & ANALYZE";
        btn.classList.remove('bg-gray-500', 'cursor-not-allowed', 'bg-red-600', 'hover:bg-red-700');
        btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
    }
}

function setupChart() {
    const ctx = document.getElementById('energyChart').getContext('2d');
    
    if (energyChart) {
        energyChart.destroy();
    }

    energyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['', '', '', '', '', '', '', '', '', 'Now'],
            datasets: [{
                label: 'Algorithmic Load (Ops)',
                data: energyHistory,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true, tension: 0.4, pointRadius: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, animation: { duration: 500 } }
    });
}

function updateChart(ops) {
    energyHistory.push(ops);
    energyHistory.shift();
    
    energyChart.data.datasets[0].data = energyHistory;
    
    energyChart.update('none'); 
}

function logToTerminal(msg, type = "INFO") {
    const terminal = document.getElementById('terminalBody');
    const colors = { "INFO": "text-blue-400", "WARN": "text-yellow-500", "ERR": "text-red-500", "SUCCESS": "text-emerald-500" };
    const lines = msg.split('\n');
    lines.forEach(line => {
        if(!line) return;
        const logEntry = document.createElement('div');
        logEntry.className = "mb-1 border-l-2 border-transparent pl-2 hover:border-emerald-500 transition-all";
        logEntry.innerHTML = `<span class="${colors[type] || 'text-white'} font-bold">${type}:</span> <span class="text-emerald-100/90">${line}</span>`;
        terminal.appendChild(logEntry);
    });
    terminal.scrollTop = terminal.scrollHeight;
}

function updateStatus(text, colorClass) {
    const s = document.getElementById('statusIndicator');
    s.innerText = text;
    s.className = `text-[10px] ${colorClass} font-black tracking-widest uppercase`;
}

function clearLogs() {
    document.getElementById('analyticsTableBody').innerHTML = `<tr id="noDataRow"><td colspan="5" class="py-8 text-center opacity-50 italic">No execution data recorded yet.</td></tr>`;
    sessionCount = 0;
}

const handler = document.getElementById('dragHandler');
const textarea = document.getElementById('codeInput');
const terminalCont = document.getElementById('terminalContainer');
let isResizing = false;

handler.addEventListener('mousedown', () => { isResizing = true; document.body.style.cursor = 'row-resize'; });
document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const top = textarea.getBoundingClientRect().top;
    let h = e.clientY - top;
    if (h > 50 && h < 350) {
        textarea.style.height = h + 'px';
        terminalCont.style.height = (400 - h) + 'px';
    }
});
document.addEventListener('mouseup', () => { isResizing = false; document.body.style.cursor = 'default'; });