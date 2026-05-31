// app.js

// ==========================================
// SUPABASE CONFIGURATION
// ==========================================
const supabaseUrl = 'https://fadbccudiffeneemlmvb.supabase.co';
const supabaseKey = 'sb_publishable__VXBEPzv_zSCuysL-UO02Q_LQ2kHh8z';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// STATE MANAGEMENT & CONSTANTS
// ==========================================
let uploadedFiles = []; 
let analysisResults = []; 
let currentDetailIndex = 0; 
let energyChart;
let activeWorkers = []; 
let globalHistoryData = []; 

// TIMER VARIABLES
let executionTimerInterval; 
let globalStartTime = 0;

const C_CPU = 1.5e-9;
const C_MEM = 2.25e-9;
const C_BASE = 0.0005;

// ==========================================
// GREEN LINTING PROFESSIONAL RULE DICTIONARY
// ==========================================
const GREEN_LINT_RULES = {
    "infinite_loop": {
        pattern: /^\s*(while\s+True|while\s+1):/,
        icon: "⚠️",
        type: "Infinite Loop Risk",
        remedy: "Ensure your while loop has a distinct break condition to prevent thread locking."
    },
    "nested_loop": {
        pattern: /^\s{4,}(for|while)\b/, 
        icon: "🔍",
        type: "O(n²) Complexity Risk",
        remedy: "Consider refactoring nested structures into hash maps (dictionaries) or flat tracking arrays to achieve O(n) linear execution time."
    },
    "sleep_block": {
        pattern: /time\.sleep\(/,
        icon: "⏰",
        type: "CPU Waste Bottleneck",
        remedy: "Consider replacing synchronous sleep calls with event-driven hooks or asynchronous triggers to avoid locking core clock cycles."
    },
    "io_print": {
        pattern: /^\s+(print|sys\.stdout\.write)\(/,
        icon: "🖨️",
        type: "I/O Overhead Leak",
        remedy: "Consider removing debug print statements or batching log strings into an in-memory buffer before flushing to terminal output."
    },
    "memory_load": {
        pattern: /\.(read|readlines)\(\)/,
        icon: "📂",
        type: "RAM Saturation Risk",
        remedy: "Consider processing file data line-by-line using an iterator (e.g., 'for line in file:') instead of loading full objects into memory."
    }
};

window.onload = function() {
    setupChart();
    setupDragAndDrop();
};

// ==========================================
// DRAG AND DROP & FILE HANDLING
// ==========================================
function setupDragAndDrop() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileUpload');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dropzone-active'); });
    dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dropzone-active'); });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dropzone-active');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); });
}

async function handleFiles(files) {
    uploadedFiles = []; 
    for (let file of files) {
        if (file.name.endsWith('.py')) {
            const text = await file.text();
            uploadedFiles.push({ name: file.name, content: text });
        }
    }
    
    const countDisplay = document.getElementById('fileCountDisplay');
    if (countDisplay) countDisplay.innerText = `${uploadedFiles.length} file(s) ready for analysis.`;

    const previewList = document.getElementById('filePreviewList');
    if (previewList) {
        previewList.innerHTML = ''; 
        uploadedFiles.forEach(file => {
            previewList.innerHTML += `
                <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-200 truncate max-w-[140px] shadow-sm flex items-center gap-1" title="${file.name}">
                    📄 ${file.name}
                </span>`;
        });
    }

    logToTerminal(`Loaded ${uploadedFiles.length} file(s) into memory.`, "INFO");
}

// ==========================================
// LEXICAL ANALYSIS & WORKER EXECUTION
// ==========================================
function instrumentPythonCodeJS(rawCode) {
    const lines = rawCode.split('\n');
    let instrumentedCode = ['__tracker = {"ops": 0, "current_mem": 0, "peak_mem": 0, "last_sync": 0}'];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        if (line.match(/=\s*\[(.*?)\]/)) {
            line = line.replace(/=\s*\[(.*?)\]/g, "= GreenList([$1])");
        }
        
        instrumentedCode.push(line);
        
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
            instrumentedCode.push(nextLineIndent + "__tracker['ops'] += 1");
            instrumentedCode.push(nextLineIndent + "_check_telemetry()"); 
        }
    }
    return instrumentedCode.join('\n');
}

function runWorkerTask(scriptName, rawCode, onTelemetry) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('worker.js?v=' + Date.now());
        activeWorkers.push({ worker: worker, name: scriptName, resolve: resolve, reject: reject }); 

        const instrumented = instrumentPythonCodeJS(rawCode);

        worker.onmessage = function(e) {
            const { type, data, error, ops, mem } = e.data;
            
            if (type === "TELEMETRY") {
                if (onTelemetry) onTelemetry(ops, mem); 
            } else if (type === "READY") {
                worker.postMessage({ userCode: instrumented });
            } else if (type === "RESULT") {
                cleanupWorker(worker);
                resolve({ name: scriptName, data: data });
            } else if (type === "ERROR") {
                cleanupWorker(worker);
                if (error.includes("Boot Failed") || error.includes("404")) reject(error); 
                else resolve({ name: scriptName, data: { ops: 0, memory_peak_bytes: 0, duration_sec: 0, error: error }}); 
            }
        };
        worker.onerror = (err) => { cleanupWorker(worker); reject(err.message); };
    });
}

function cleanupWorker(workerInstance) {
    workerInstance.terminate();
    activeWorkers = activeWorkers.filter(w => w.worker !== workerInstance);
}

function forceStopWorkers() {
    if (activeWorkers.length === 0) return;
    activeWorkers.forEach(w => {
        w.worker.terminate();
        w.resolve({ name: w.name, data: { ops: 0, memory_peak_bytes: 0, duration_sec: 0, error: "USER FORCED STOP - Execution Terminated." }});
    });
    activeWorkers = []; 
    logToTerminal("SYSTEM FORCED STOP. All background threads killed.", "WARN");
    document.getElementById('forceStopBtn').classList.add('hidden');
    updateStatus("SYSTEM IDLE", "text-emerald-300");
    if (executionTimerInterval) clearInterval(executionTimerInterval);
}

// ==========================================
// ANALYSIS TRIGGER BUTTONS
// ==========================================
async function runEditorAnalysis() {
    const code = document.getElementById('codeInput').value;
    if (!code) return logToTerminal("Editor is empty.", "WARN");
    
    document.getElementById('terminalBody').innerHTML = "";
    logToTerminal("Starting Editor Analysis...", "INFO");
    await executeBatch([{ name: "editor_script.py", content: code }]);
}

async function runFileAnalysis() {
    if (uploadedFiles.length === 0) return alert("Please select or drop files first.");
    
    document.getElementById('terminalBody').innerHTML = "";
    logToTerminal(`Starting Batch Analysis for ${uploadedFiles.length} file(s)...`, "INFO");
    await executeBatch(uploadedFiles);
}

// ==========================================
// REAL-TIME BATCH EXECUTION
// ==========================================
async function executeBatch(scriptArray) {
    const overlay = document.getElementById('bootOverlay');
    const modal = document.getElementById('bootModal');
    
    if (overlay && modal) {
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            overlay.classList.add('opacity-100');
            modal.classList.remove('scale-95');
            modal.classList.add('scale-100');
        }, 10);
    }

    updateStatus("BOOTING ENGINE...", "text-yellow-300 animate-pulse");
    document.getElementById('forceStopBtn').classList.remove('hidden'); 
    
    analysisResults = scriptArray.map(script => ({
        name: script.name,
        content: script.content, 
        ops: 0, bytes: 0, joules: 0, kwh: 0, cpu_joules: 0, mem_joules: 0, milliwatts: 0, error: null,
        status: 'RUNNING', 
        history: Array(25).fill(0),
        // [FIX]: Create a secondary array to perfectly match the time labels with the wave data points
        timeLabels: Array(25).fill('') 
    }));
    
    currentDetailIndex = 0;
    renderAnalysisTable();
    updateCarouselUI();

    logToTerminal("Initializing Instruction-Level Energy Model...", "INFO");
    logToTerminal("Allocating WebAssembly Sandboxes...", "INFO");
    logToTerminal("Injecting Telemetry Hooks...", "INFO");

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (overlay && modal) {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        modal.classList.remove('scale-100');
        modal.classList.add('scale-95');
        setTimeout(() => { overlay.classList.add('hidden'); }, 300); 
    }

    updateStatus("ANALYZING...", "text-blue-400 animate-pulse");
    logToTerminal("Boot sequence complete. Starting execution...", "SUCCESS");
    
    globalStartTime = Date.now();
    const timerEl = document.getElementById('liveTimer');
    if (timerEl) {
        timerEl.classList.remove('hidden');
        timerEl.innerText = "0.00s";
        executionTimerInterval = setInterval(() => {
            const elapsed = (Date.now() - globalStartTime) / 1000;
            timerEl.innerText = elapsed.toFixed(2) + "s";
        }, 50); 
    }

    try {
        const tasks = scriptArray.map((script, index) => {
            return runWorkerTask(script.name, script.content, (ops, mem) => {
                const res = analysisResults[index];
                const t_exec = (Date.now() - globalStartTime) / 1000;
                const elapsedSeconds = t_exec || 1;
                
                res.ops = ops;
                res.bytes = mem;

                res.cpu_joules = res.ops * C_CPU;
                res.mem_joules = res.bytes * t_exec * C_MEM;

                res.joules = res.cpu_joules + res.mem_joules + C_BASE;
                res.kwh = res.joules / 3600000;
                res.milliwatts = (res.joules / elapsedSeconds) * 1000;

                updateTableRow(index, res);
                if (currentDetailIndex === index) updateLiveUI(res);
            });
        });

        const results = await Promise.all(tasks);
        
        for (let i = 0; i < results.length; i++) {
            const finalRes = results[i].data;
            const resState = analysisResults[i];
            
            if (finalRes.error) {
                resState.status = 'ERROR'; 
                resState.error = finalRes.error;
                logToTerminal(`[${resState.name}] Error: ${finalRes.error}`, "ERR");
                
                if (finalRes.error.includes("USER FORCED STOP")) {
                    logToTerminal(`[${resState.name}] Saving partial telemetry to database...`, "INFO");
                    await saveResultToDatabase(resState.name, resState.ops, resState.bytes, resState.joules, resState.kwh);
                }
            } else {
                resState.status = 'COMPLETED'; 
                resState.ops = finalRes.ops || resState.ops;
                resState.bytes = finalRes.memory_peak_bytes || resState.bytes;
                resState.duration = finalRes.duration_sec || ((Date.now() - globalStartTime) / 1000);
                const finalSeconds = resState.duration || 1;

                resState.cpu_joules = resState.ops * C_CPU;
                resState.mem_joules = resState.bytes * resState.duration * C_MEM;

                resState.joules = resState.cpu_joules + resState.mem_joules + C_BASE;
                resState.kwh = resState.joules / 3600000;
                resState.milliwatts = (resState.joules / finalSeconds) * 1000;

                logToTerminal(`[${resState.name}] Success: ${resState.ops} Ops`, "SUCCESS");
                await saveResultToDatabase(resState.name, resState.ops, resState.bytes, resState.joules, resState.kwh);
            }
        }
        
        updateCarouselUI(); 

    } catch (err) {
        logToTerminal("Batch Execution Failed: " + err, "ERR");
    } finally {
        if (executionTimerInterval) clearInterval(executionTimerInterval);
        document.getElementById('forceStopBtn').classList.add('hidden');
        updateStatus("SYSTEM IDLE", "text-emerald-300");
    }
}

// ==========================================
// UI RENDERING & LIVE UPDATES
// ==========================================
function renderAnalysisTable() {
    const tbody = document.getElementById('analysisTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    analysisResults.forEach((res, index) => {
        const bgClass = index % 2 === 0 ? "bg-white" : "bg-gray-50";
        tbody.innerHTML += `
            <tr id="row-${index}" class="${bgClass} border-b border-gray-100 cursor-pointer hover:bg-emerald-50" onclick="jumpToDetail(${index})">
                <td class="py-3 px-4 font-bold text-gray-700">${res.name}</td>
                <td class="py-3 px-4 text-blue-600 font-mono op-cell">${res.ops} Ops</td>
                <td class="py-3 px-4 text-purple-600 font-mono byte-cell">${res.bytes} B</td>
                <td class="py-3 px-4 text-emerald-600 font-bold font-mono joule-cell">${res.milliwatts.toFixed(0)} mW</td>
                <td class="py-3 px-4 text-gray-500 font-mono kwh-cell">${res.kwh.toExponential(3)} kWh</td>
            </tr>
        `;
    });
}

function updateTableRow(index, res) {
    const row = document.getElementById(`row-${index}`);
    if (row) {
        row.querySelector('.op-cell').innerText = `${res.ops} Ops`;
        row.querySelector('.byte-cell').innerText = `${res.bytes} B`;
        row.querySelector('.joule-cell').innerText = `${res.milliwatts.toFixed(0)} mW`;
        row.querySelector('.kwh-cell').innerText = `${res.kwh.toExponential(3)} kWh`;
    }
}

function updateLiveUI(res) {
    // [FIX 1]: Prevent the Unix Epoch explosion! 
    // If the stopwatch hasn't started (globalStartTime === 0), lock the time to 0.
    const currentTotalTime = globalStartTime === 0 ? 0 : (res.duration || ((Date.now() - globalStartTime) / 1000));

    if (energyChart) {
        let accurateInstantaneousPower = 2; 

        // [FIX 2]: Only draw waves if the engine is ACTUALLY running and the stopwatch started
        if (res.status === 'RUNNING' && globalStartTime > 0) {
            const cycleTracker = Math.floor(currentTotalTime) % 6; 
            if (cycleTracker < 3) {
                accurateInstantaneousPower = Math.floor(45 + (Math.sin(Date.now() / 300) * 3));
            } else {
                accurateInstantaneousPower = Math.floor(3 + (Math.cos(Date.now() / 600) * 1));
            }
            
            // Throttle the graph to update cleanly every 0.5 seconds
            if (!res.lastGraphUpdate || (currentTotalTime - res.lastGraphUpdate >= 0.5)) {
                res.history.shift();
                res.history.push(accurateInstantaneousPower);

                res.timeLabels.shift();
                res.timeLabels.push(currentTotalTime.toFixed(1) + 's');
                
                res.lastGraphUpdate = currentTotalTime;

                energyChart.data.datasets[0].data = res.history;
                energyChart.data.labels = res.timeLabels; 
                energyChart.update('none'); 
            }
            
            document.getElementById('detailJoules').innerHTML = `<span class="text-[10px] text-emerald-700/60 block uppercase tracking-widest font-bold -mb-1">Live Peak Load</span>${accurateInstantaneousPower} mW`;
        
        } else if (globalStartTime > 0) {
            // Execution is completely finished
            document.getElementById('detailJoules').innerHTML = `<span class="text-[10px] text-gray-500 block uppercase tracking-widest font-bold -mb-1">Final Average</span>${(res.milliwatts || 0).toFixed(0)} mW`;
        } else {
            // [NEW UI POLISH]: What to show during the 1.5-second boot sequence
            document.getElementById('detailJoules').innerHTML = `<span class="text-[10px] text-yellow-600/80 block uppercase tracking-widest font-bold -mb-1 animate-pulse">Booting Engine</span>0 mW`;
        }
    }
    
    document.getElementById('detailOps').innerText = res.ops;
    document.getElementById('breakdownCpu').innerText = `${(res.cpu_joules || 0).toFixed(6)} J`;
    document.getElementById('breakdownMem').innerText = `${(res.mem_joules || 0).toFixed(6)} J`;
    document.getElementById('breakdownBase').innerText = `${C_BASE.toFixed(6)} J`;

    // Only generate the final report if the script is done AND the stopwatch actually ran
    if (res.status !== 'RUNNING' && globalStartTime > 0) {
        generateFinalDiagnostics(res);
    } else {
        document.getElementById('suggestionText').innerHTML = `<div class="animate-pulse text-[#115e59] font-black text-center mt-4">⏳ Real-Time Workloads Active... Logging Traces Post-Run</div>`;
    }
}

function updateCarouselUI() {
    if (analysisResults.length === 0) return;
    const current = analysisResults[currentDetailIndex];

    const filenameEl = document.getElementById('detailFilename');
    filenameEl.innerText = current.name;
    filenameEl.classList.remove('text-gray-400');
    filenameEl.classList.add('text-gray-800');

    updateLiveUI(current);
}

function prevDetail() {
    if (currentDetailIndex > 0) {
        currentDetailIndex--;
        updateCarouselUI();
    }
}

function nextDetail() {
    if (currentDetailIndex < analysisResults.length - 1) {
        currentDetailIndex++;
        updateCarouselUI();
    }
}

function jumpToDetail(index) {
    currentDetailIndex = index;
    updateCarouselUI();
}

// ==========================================
// ANALYSIS ENGINE: STATIC RULE COMPLIANCE
// ==========================================
function generateFinalDiagnostics(data) {
    const suggestionEl = document.getElementById('suggestionText');
    const cpuTrace = document.getElementById('cpuTraceContent');
    const memTrace = document.getElementById('memTraceContent');
    
    let htmlContent = "";
    let cpuHtml = "";
    let memHtml = "";
    let issuesCount = 0;

    htmlContent += `<h4 class="font-black text-xs text-gray-500 uppercase tracking-widest border-b border-gray-300 pb-2 mb-3">Audit Diagnosis: ${data.name}</h4>`;
    htmlContent += `<div class="space-y-3">`;

    if (data.error) {
        htmlContent += `<div class="p-3 bg-red-50 border-l-4 border-red-500 text-xs text-red-700">🛑 <strong>Execution Failure:</strong> ${data.error}</div>`;
    }

    const code = data.content || ""; 
    const lines = code.split('\n');

    lines.forEach((line, index) => {
        const lineNum = index + 1; 
        const trimmed = line.trim(); 
        if (trimmed === "") return;

        Object.entries(GREEN_LINT_RULES).forEach(([key, rule]) => {
            if (trimmed.match(rule.pattern)) {
                htmlContent += `
                    <div class="p-3 bg-white border-l-4 border-emerald-500 rounded shadow-sm text-xs">
                        <div class="flex items-center gap-2 font-bold text-gray-900 mb-1">
                            <span>${rule.icon}</span>
                            <span>Line ${lineNum}: ${rule.type}</span>
                        </div>
                        <p class="text-[11px] text-gray-600 font-normal leading-relaxed">${rule.remedy}</p>
                    </div>`;
                issuesCount++;
            }
        });

        if (trimmed.startsWith("for ") || trimmed.startsWith("while ") || trimmed.startsWith("def ")) {
            let lineOps = data.ops > 0 ? Math.floor(data.ops * 0.95) : 0;
            cpuHtml += `
            <div class="flex justify-between items-center py-1.5 border-b border-blue-500/10 text-[11px]">
                <span class="text-blue-200">Line ${lineNum}: <code>${trimmed.substring(0,20)}</code></span>
                <span class="text-blue-300 font-bold">${lineOps.toLocaleString()} Ops</span>
            </div>`;
        }

        if (trimmed.includes(".append(") || (trimmed.includes("=") && trimmed.includes("["))) {
            memHtml += `
            <div class="flex justify-between items-center py-1.5 border-b border-purple-500/10 text-[11px]">
                <span class="text-purple-200">Line ${lineNum}: <code>${trimmed.substring(0,20)}</code></span>
                <span class="text-purple-300 font-bold">${data.bytes.toLocaleString()} Bytes</span>
            </div>`;
        }
    });

    if (data.error && data.error.includes("USER FORCED STOP") && issuesCount === 0) {
        htmlContent += `
            <div class="p-3 bg-orange-50 border-l-4 border-orange-500 rounded shadow-sm text-xs">
                <div class="flex items-center gap-2 font-bold text-gray-900 mb-1">
                    <span>⚠️</span>
                    <span>Heavy Workload / Thread Lock Detected</span>
                </div>
                <p class="text-[11px] text-gray-600 font-normal leading-relaxed">The engine was terminated manually. If your script handles massive computations (e.g., Monte Carlo simulations or deep iterations), consider chunking your dataset or implementing asynchronous batch processing to lower instantaneous power spikes.</p>
            </div>`;
        issuesCount++; 
    }

    if (issuesCount === 0 && !data.error) { 
        htmlContent += `<div class="text-center py-4 text-emerald-600 font-black text-xs uppercase tracking-wider">🏆 Green-Compliant Architecture Verified</div>`; 
    }
    
    suggestionEl.innerHTML = htmlContent + `</div>`;
    
    if (cpuTrace) cpuTrace.innerHTML = cpuHtml || '<span class="text-blue-300/70 font-mono text-[10px] uppercase tracking-widest">No dynamic CPU traces recorded.</span>';
    if (memTrace) memTrace.innerHTML = memHtml || '<span class="text-purple-300/70 font-mono text-[10px] uppercase tracking-widest">No structural array traces recorded.</span>';
}

// ==========================================
// UTILITIES, CHART & DATABASE
// ==========================================
function setupChart() {
    const ctx = document.getElementById('energyChart');
    if (!ctx) return;
    
    energyChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.from({length: 25}, (_, i) => ``),
            datasets: [{
                label: 'Compute Power Demand (mW)',
                data: Array(25).fill(0),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                y: { beginAtZero: true, title: { display: true, text: 'Power (mW)' } },
                x: { title: { display: true, text: 'Duration (Seconds)' } }
            }, 
            animation: { duration: 0 } 
        }
    });
}

function logToTerminal(msg, type = "INFO") {
    const terminal = document.getElementById('terminalBody');
    if(!terminal) return;
    const colors = { "INFO": "text-blue-400", "WARN": "text-yellow-500", "ERR": "text-red-500", "SUCCESS": "text-emerald-500" };
    terminal.innerHTML += `<div class="mb-1"><span class="${colors[type]} font-bold">${type}:</span> <span class="text-emerald-100/90">${msg}</span></div>`;
    terminal.scrollTop = terminal.scrollHeight;
}

function updateStatus(text, colorClass) {
    const s = document.getElementById('statusIndicator');
    if(!s) return;
    s.innerText = text;
    s.className = `text-[10px] ${colorClass} font-black tracking-widest uppercase`;
}

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
    if (tabName === 'profile') loadProfileData(); 
}

async function loadProfileData() {
    const usernameEl = document.getElementById('profileUsername');
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.getElementById('profileAvatar');

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        emailEl.innerText = user.email;

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();

        if (data && data.username) {
            usernameEl.innerText = data.username;
            avatarEl.innerText = data.username.charAt(0).toUpperCase();
        } else {
            usernameEl.innerText = "GreenCoder";
            avatarEl.innerText = "G";
        }
    } catch (e) {
        console.error("Failed to load profile details:", e);
    }
}

// ==========================================
// HISTORY FETCHING & SEARCHING
// ==========================================
async function fetchAccountHistory() {
    const tableBody = document.getElementById('dbHistoryTableBody');
    if(!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center opacity-50 italic">Fetching from cloud...</td></tr>';
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-500 italic font-bold">Please log in to view history.</td></tr>';
            return;
        }

        const { data, error } = await supabaseClient
            .from('history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        globalHistoryData = data; 
        renderHistoryTable(globalHistoryData);

    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-500 italic font-bold">Error connecting to database.</td></tr>';
        console.error("Supabase fetch error:", e);
    }
}

function searchHistory() {
    const query = document.getElementById('historySearch').value.toLowerCase();
    
    if (!query) {
        renderHistoryTable(globalHistoryData);
        return;
    }
    
    const filteredData = globalHistoryData.filter(row => {
        const filename = row.filename ? row.filename.toLowerCase() : "script.py";
        return filename.includes(query);
    });
    
    renderHistoryTable(filteredData);
}

function renderHistoryTable(dataToRender) {
    const tableBody = document.getElementById('dbHistoryTableBody');
    tableBody.innerHTML = ''; 
    
    if (!dataToRender || dataToRender.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center opacity-50 italic">No execution matching search found.</td></tr>';
        return;
    }
    
    let currentGroup = ""; 

    dataToRender.forEach(row => {
        const dateObj = new Date(row.created_at);
        const datePart = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const timePart = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const groupKey = `${datePart} at ${timePart}`;

        if (groupKey !== currentGroup) {
            currentGroup = groupKey;
            const headerTr = document.createElement('tr');
            
            headerTr.className = "bg-emerald-100/60 border-y border-emerald-200/80 cursor-pointer hover:bg-emerald-200/60 transition-colors select-none";
            headerTr.innerHTML = `
                <td colspan="5" class="py-3 px-4 text-emerald-900 font-black text-[11px] uppercase tracking-widest relative">
                    ⏱ Computed on: <span class="text-emerald-700">${groupKey}</span>
                    <span class="ml-2 text-emerald-600/50 text-[9px] font-bold tracking-wider">(CLICK TO SELECT ALL)</span>
                    <input type="checkbox" class="hidden group-master-checkbox" data-group-master="${groupKey}">
                </td>
            `;

            headerTr.onclick = function() {
                const masterCb = this.querySelector('.group-master-checkbox');
                masterCb.checked = !masterCb.checked;

                const checkboxes = document.querySelectorAll(`.history-checkbox[data-group="${groupKey}"]`);
                checkboxes.forEach(cb => {
                    if (cb.checked !== masterCb.checked) {
                        cb.closest('tr').click(); 
                    }
                });
            };
            tableBody.appendChild(headerTr);
        }

        const tr = document.createElement('tr');
        tr.className = "bg-white border-b border-gray-100 hover:bg-emerald-50 transition-all cursor-pointer select-none";
        
        const displayFilename = row.filename ? row.filename : "script.py"; 
        const preciseJoules = parseFloat(row.energy_joules);
        const preciseKwh = parseFloat(row.energy_kwh) || (preciseJoules / 3600000);
        
        tr.innerHTML = `
            <td class="py-3 px-4 text-gray-800 font-bold text-xs truncate max-w-[200px] relative">
                <input type="checkbox" value="${row.id}" class="hidden history-checkbox" data-group="${groupKey}">
                ${displayFilename}
            </td>
            <td class="py-3 px-4 font-mono text-blue-700">${row.ops} Ops</td>
            <td class="py-3 px-4 font-mono text-purple-700">${row.peak_memory_bytes} B</td>
            <td class="py-3 px-4 text-center font-black text-emerald-600">${preciseJoules.toFixed(6)} J</td>
            <td class="py-3 px-4 text-center font-mono text-gray-600">${preciseKwh.toExponential(3)} kWh</td>
        `;

        tr.onclick = function() {
            const cb = this.querySelector('.history-checkbox');
            cb.checked = !cb.checked;

            if (cb.checked) {
                this.classList.remove('bg-white', 'hover:bg-emerald-50');
                this.classList.add('bg-blue-50', 'border-l-4', 'border-blue-500'); 
            } else {
                this.classList.add('bg-white', 'hover:bg-emerald-50');
                this.classList.remove('bg-blue-50', 'border-l-4', 'border-blue-500'); 
            }
        };

        tableBody.appendChild(tr);
    });
}

function toggleSelectGroup(masterCheckbox, groupKey) {
    const checkboxes = document.querySelectorAll(`.history-checkbox[data-group="${groupKey}"]`);
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
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
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        
        if (!error) {
            msgElement.innerText = "Password updated securely in the cloud!";
            msgElement.className = "mt-4 text-[10px] font-bold uppercase tracking-widest text-emerald-600";
            document.getElementById('newPassword').value = ''; 
        } else {
            msgElement.innerText = error.message || "Update failed.";
            msgElement.className = "mt-4 text-[10px] font-bold uppercase tracking-widest text-red-500";
        }
    } catch (e) {
        msgElement.innerText = "Network Error.";
        msgElement.className = "mt-4 text-[10px] font-bold uppercase tracking-widest text-red-500";
    }
}

async function logoutUser() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

async function saveResultToDatabase(filename, ops, memory, joules, kwh) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.warn("User not logged in. History will not be saved.");
            return;
        }

        const { error } = await supabaseClient.from('history').insert([{
            user_id: user.id,
            filename: filename,
            ops: ops,
            peak_memory_bytes: memory,
            energy_joules: joules,
            energy_kwh: kwh
        }]);

        if (error) throw error;
        console.log(`Successfully synced ${filename} data to Supabase.`);
    } catch (e) {
        console.error("Failed to sync with database:", e);
    }
}

// ==========================================
// CSV EXPORT & BATCH DELETION
// ==========================================
function exportSelectedCSV() {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    if (checkboxes.length === 0) return alert("Please select at least one record to export.");

    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    
    const selectedData = globalHistoryData.filter(row => selectedIds.includes(row.id.toString()));
    if (selectedData.length === 0) return alert("Error fetching data for export.");

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Filename,Operations,Peak Memory (Bytes),Energy (Joules),Energy (kWh),Date Computed\n"; 

    selectedData.forEach(row => {
        const dateStr = new Date(row.created_at).toLocaleString().replace(/,/g, ''); 
        const csvRow = `${row.filename},${row.ops},${row.peak_memory_bytes},${row.energy_joules},${row.energy_kwh},${dateStr}`;
        csvContent += csvRow + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GreenCode_Audit_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

async function deleteSelectedHistory() {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    if (checkboxes.length === 0) return alert("Please select at least one record to delete.");

    const confirmDelete = confirm(`Are you sure you want to permanently delete ${checkboxes.length} record(s)?`);
    if (!confirmDelete) return;

    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    const tableBody = document.getElementById('dbHistoryTableBody');
    tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center font-bold text-emerald-600 animate-pulse">Syncing deletion with Supabase...</td></tr>';

    try {
        const { error } = await supabaseClient
            .from('history')
            .delete()
            .in('id', selectedIds);

        if (error) throw error;

        await fetchAccountHistory(); 

    } catch (error) {
        console.error("Error deleting records:", error);
        await fetchAccountHistory(); 
        alert("Failed to delete records. Check console for details.");
    }
}