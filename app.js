// app.js
let energyHistory = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let worker = null;
let energyChart;

window.onload = function() {
    setupChart();
    initWorker();
};

function instrumentPythonCodeJS(rawCode) {
    const lines = rawCode.split('\n');
    
    // Initialize the mathematical tracker for BOTH Ops and Memory
    let instrumentedCode = ['__tracker = {"ops": 0, "current_mem": 0, "peak_mem": 0}'];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // --- PROXY OBJECT INTERCEPTOR ---
        // Converts standard list assignments into GreenList proxies dynamically
        if (line.match(/=\s*\[(.*?)\]/)) {
            line = line.replace(/=\s*\[(.*?)\]/g, "= GreenList([$1])");
        }
        // --------------------------------
        
        instrumentedCode.push(line);
        
        // Time Complexity Ops tracking
        if (line.match(/^\s*(for|while|def)\b.*:/)) {
            let nextLineIndent = "    "; 
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() !== "") {
                    let match = lines[j].match(/^(\s+)/);
                    if (match) nextLineIndent = match[1];
                    else nextLineIndent = line.match(/^(\s*)/)[1] + "    ";
                    break;
                }
            }
            // Inject the counter inside the loop body
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

    // Physics Constants
    const C_CPU = 1.5e-9;
    const C_MEM = 2.25e-9;
    const C_BASE = 0.0005;

    const energy_cpu = N_ops * C_CPU;
    const energy_mem = M_peak * T_exec * C_MEM;
    const total_energy = energy_cpu + energy_mem + C_BASE;
    const total_kwh = total_energy / 3600000;

    document.getElementById('totalJoulesDisp').innerHTML = `${total_energy.toFixed(6)} J`;
    document.getElementById('opsCount').innerText = N_ops;
    
    updateChart(N_ops);
    saveResultToDatabase(N_ops, M_peak, total_energy, total_kwh);
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
    if (energyChart) energyChart.destroy();

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
    if(!terminal) return;
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
    if(!s) return;
    s.innerText = text;
    s.className = `text-[10px] ${colorClass} font-black tracking-widest uppercase`;
}

const handler = document.getElementById('dragHandler');
const textarea = document.getElementById('codeInput');
const terminalCont = document.getElementById('terminalContainer');
let isResizing = false;

if(handler) {
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
}

// ==========================================
// TABS, DATABASE, AND PROFILE MANAGEMENT
// ==========================================

function switchTab(tabName) {
    document.getElementById('tab-analyzer').classList.add('tab-hidden');
    document.getElementById('tab-history').classList.add('tab-hidden');
    document.getElementById('tab-profile').classList.add('tab-hidden');

    ['analyzer', 'history', 'profile'].forEach(name => {
        let btn = document.getElementById(`nav-${name}`);
        if(btn) {
            btn.classList.remove('text-emerald-300', 'border-emerald-300');
            btn.classList.add('text-white/60', 'border-transparent');
        }
    });

    document.getElementById(`tab-${tabName}`).classList.remove('tab-hidden');
    let activeBtn = document.getElementById(`nav-${tabName}`);
    if(activeBtn) {
        activeBtn.classList.remove('text-white/60', 'border-transparent');
        activeBtn.classList.add('text-emerald-300', 'border-emerald-300');
    }

    if (tabName === 'history') fetchAccountHistory();
}

async function fetchAccountHistory() {
    const tableBody = document.getElementById('dbHistoryTableBody');
    if(!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center opacity-50 italic">Fetching from cloud...</td></tr>';
    
    try {
        const response = await fetch('api/get_history.php');
        const data = await response.json();
        
        if (data.success) {
            tableBody.innerHTML = ''; 
            if (data.results.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center opacity-50 italic">No execution history found for this account.</td></tr>';
                return;
            }
            
            data.results.forEach(row => {
                const tr = document.createElement('tr');
                tr.className = "bg-white/50 border border-emerald-50 hover:bg-emerald-50/80 transition-all";
                tr.innerHTML = `
                    <td class="py-4 px-2 text-gray-500 font-bold text-[10px]">${row.created_at}</td>
                    <td class="py-4 px-2 font-mono text-blue-700">${row.ops} Ops</td>
                    <td class="py-4 px-2 font-mono text-purple-700">${row.peak_memory_bytes} B</td>
                    <td class="py-4 px-2 text-center font-black text-emerald-600">${parseFloat(row.energy_joules).toFixed(6)} J</td>
                    <td class="py-4 px-2 text-center font-mono text-gray-600">${parseFloat(row.energy_kwh).toExponential(3)} kWh</td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-500 italic">Please log in to view history.</td></tr>';
        }
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-500 italic">Error connecting to database.</td></tr>';
    }
}

async function updateProfile() {
    const newPassword = document.getElementById('newPassword').value;
    const msgElement = document.getElementById('profileMsg');
    
    if(!newPassword) {
        msgElement.innerText = "Please enter a new password.";
        msgElement.className = "mt-4 text-[10px] font-bold uppercase tracking-widest text-red-500";
        return;
    }

    try {
        const res = await fetch('api/update_profile.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ password: newPassword })
        });
        const data = await res.json();
        
        if (data.success) {
            msgElement.innerText = "Password updated successfully!";
            msgElement.className = "mt-4 text-[10px] font-bold uppercase tracking-widest text-emerald-600";
            document.getElementById('newPassword').value = ''; 
        } else {
            msgElement.innerText = data.error || "Update failed.";
            msgElement.className = "mt-4 text-[10px] font-bold uppercase tracking-widest text-red-500";
        }
    } catch (e) {
        msgElement.innerText = "Network Error.";
        msgElement.className = "mt-4 text-[10px] font-bold uppercase tracking-widest text-red-500";
    }
}

async function logoutUser() {
    await fetch('api/logout.php');
    window.location.href = 'login.html';
}

async function saveResultToDatabase(ops, memory, joules, kwh) {
    try {
        await fetch('api/save_result.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ops: ops,
                memory_peak_bytes: memory,
                energy_joules: joules,
                energy_kwh: kwh
            })
        });
    } catch (e) {
        console.error("Failed to sync with database.");
    }
}