// Generate unique user and session IDs for local testing
const userId = "farmer_user_" + Math.random().toString(36).substring(2, 9);
const sessionId = "session_" + Math.random().toString(36).substring(2, 9);

let uploadedFileName = null;

// Tab Switching Logic
function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('data-tab') === tabId) {
            el.classList.add('active');
        }
    });

    document.querySelectorAll('.tab-pane').forEach(el => {
        el.classList.remove('active');
    });

    const activePane = document.getElementById(`tab-${tabId}`);
    if (activePane) {
        activePane.classList.add('active');
    }

    // Update headers
    const titles = {
        'dashboard': { title: 'Workspace Dashboard', sub: 'Real-time agricultural decision metrics & alerts' },
        'vision': { title: 'Crop Vision Diagnostic', sub: 'Multimodal analysis of leaves, soil, and crop conditions' },
        'weather-market': { title: 'Weather & Markets', sub: 'Location weather modeling and commodity crop price feeds' },
        'logs': { title: 'Crop Logs Tracker', sub: 'Historical records and operation tracking sheets' },
        'advisory': { title: 'Advisory Studio', sub: 'Generate 4-signal fusion recommendation reports' }
    };

    if (titles[tabId]) {
        document.getElementById('tab-title').textContent = titles[tabId].title;
        document.getElementById('tab-subtitle').textContent = titles[tabId].sub;
    }
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Image Upload Zone
    const dropzone = document.getElementById('dropzone');
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    const uploadIcon = dropzone.querySelector('.upload-icon');
    const uploadText = dropzone.querySelector('p');
    const btnAnalyze = document.getElementById('btn-analyze-vision');

    dropzone.addEventListener('click', () => imageUpload.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#10b981';
        dropzone.style.background = 'rgba(16, 185, 129, 0.08)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        dropzone.style.background = 'rgba(16, 185, 129, 0.01)';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        dropzone.style.background = 'rgba(16, 185, 129, 0.01)';
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    imageUpload.addEventListener('change', () => {
        if (imageUpload.files.length) {
            handleFile(imageUpload.files[0]);
        }
    });

    async function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }

        // Show Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            uploadIcon.style.display = 'none';
            uploadText.style.display = 'none';
            btnAnalyze.disabled = false;
        };
        reader.readAsDataURL(file);

        // Upload to Artifact Service
        uploadedFileName = file.name;
        btnAnalyze.disabled = true;
        btnAnalyze.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading Image...';

        const base64Reader = new FileReader();
        base64Reader.onloadend = async () => {
            const base64Data = base64Reader.result.split(',')[1];
            try {
                const res = await fetch(`/apps/croppulse-ai/users/${userId}/sessions/${sessionId}/artifacts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        artifact: {
                            inline_data: {
                                data: base64Data,
                                mime_type: file.type
                            }
                        }
                    })
                });
                if (res.ok) {
                    console.log("Image uploaded as artifact successfully.");
                    btnAnalyze.disabled = false;
                    btnAnalyze.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Run Diagnostic';
                } else {
                    throw new Error("Upload failed.");
                }
            } catch (err) {
                console.error("Artifact upload error:", err);
                alert("Failed to upload image to session artifacts.");
                btnAnalyze.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Run Diagnostic';
            }
        };
        base64Reader.readAsDataURL(file);
    }

    // Vision Analysis Execution
    btnAnalyze.addEventListener('click', async () => {
        const mode = document.getElementById('vision-mode').value;
        const resultDiv = document.getElementById('vision-result');
        const placeholderDiv = document.getElementById('vision-placeholder');

        placeholderDiv.style.display = 'none';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #10b981;"></i><p style="margin-top: 1rem; color: #94a3b8;">Analyzing crop health...</p></div>';

        try {
            const response = await fetch('/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    session_id: sessionId,
                    new_message: {
                        parts: [{ text: `Analyze my crop image using ${mode} mode.` }]
                    }
                })
            });

            if (!response.ok) throw new Error("Agent execution failed");
            const events = await response.json();
            
            // Format and display output
            const output = extractFinalOutput(events);
            resultDiv.innerHTML = `<div class="formatted-output">${formatMarkdown(output)}</div>`;
        } catch (err) {
            resultDiv.innerHTML = `<div class="error-msg" style="color: #ef4444;"><i class="fa-solid fa-circle-exclamation"></i> Error running diagnostic: ${err.message}</div>`;
        }
    });

    // Weather Fetch Execution
    document.getElementById('btn-fetch-weather').addEventListener('click', async () => {
        const lat = document.getElementById('lat').value;
        const lng = document.getElementById('lng').value;
        const resultDiv = document.getElementById('wm-result');
        const placeholderDiv = document.getElementById('wm-placeholder');

        placeholderDiv.style.display = 'none';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color: #3b82f6;"></i> Querying Open-Meteo...';

        try {
            const response = await fetch('/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    session_id: sessionId,
                    new_message: {
                        parts: [{ text: `Get weather forecast for latitude ${lat} and longitude ${lng}.` }]
                    }
                })
            });

            if (!response.ok) throw new Error("Weather request failed");
            const events = await response.json();
            const output = extractFinalOutput(events);
            resultDiv.innerHTML = `<div class="formatted-output">${formatMarkdown(output)}</div>`;
            
            // Try updating dashboard weather value
            try {
                const parsed = JSON.parse(output);
                if (parsed.temperature_celsius) {
                    document.getElementById('dash-weather').textContent = `${parsed.temperature_celsius}°C`;
                }
            } catch(e) {}
        } catch (err) {
            resultDiv.innerHTML = `<div style="color: #ef4444;">Error: ${err.message}</div>`;
        }
    });

    // Market Fetch Execution
    document.getElementById('btn-fetch-price').addEventListener('click', async () => {
        const commodity = document.getElementById('crop-commodity').value;
        const resultDiv = document.getElementById('wm-result');
        const placeholderDiv = document.getElementById('wm-placeholder');

        placeholderDiv.style.display = 'none';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color: #3b82f6;"></i> Fetching commodity ticker...';

        try {
            const response = await fetch('/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    session_id: sessionId,
                    new_message: {
                        parts: [{ text: `What is the crop market price for ${commodity}?` }]
                    }
                })
            });

            if (!response.ok) throw new Error("Price request failed");
            const events = await response.json();
            const output = extractFinalOutput(events);
            resultDiv.innerHTML = `<div class="formatted-output">${formatMarkdown(output)}</div>`;
            
            // Try updating dashboard price value
            try {
                const parsed = JSON.parse(output);
                if (parsed.current_price) {
                    document.getElementById('dash-price').textContent = `$${parsed.current_price} / ${parsed.unit}`;
                }
            } catch(e) {}
        } catch (err) {
            resultDiv.innerHTML = `<div style="color: #ef4444;">Error: ${err.message}</div>`;
        }
    });

    // Write Log Entry Execution
    document.getElementById('btn-write-log').addEventListener('click', async () => {
        const sheet = document.getElementById('sheet-name').value;
        const crop = document.getElementById('log-crop').value;
        const status = document.getElementById('log-status').value;
        const notes = document.getElementById('log-notes').value;

        if (!crop || !status) {
            alert("Please fill in Crop and Status/Action fields.");
            return;
        }

        const btn = document.getElementById('btn-write-log');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            const payload = JSON.stringify({ crop, status, notes });
            const response = await fetch('/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    session_id: sessionId,
                    new_message: {
                        parts: [{ text: `Append a row to sheet ${sheet} containing log ${payload}.` }]
                    }
                })
            });

            if (!response.ok) throw new Error("Logging failed");
            await response.json();
            
            // Clear inputs
            document.getElementById('log-crop').value = '';
            document.getElementById('log-status').value = '';
            document.getElementById('log-notes').value = '';
            
            alert("Log entry written successfully!");
            loadLogs();
        } catch (err) {
            alert(`Failed to write log: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-file-pen"></i> Submit Log Entry';
        }
    });

    // Refresh Logs Button
    document.getElementById('btn-refresh-logs').addEventListener('click', loadLogs);

    // Advisory Studio Execution
    document.getElementById('btn-generate-advisory').addEventListener('click', async () => {
        const resultDiv = document.getElementById('advisory-result');
        resultDiv.innerHTML = '<div style="text-align: center; padding: 4rem;"><i class="fa-solid fa-spinner fa-spin fa-3x" style="color: #10b981; margin-bottom: 1.5rem;"></i><p>Fusing 4 signals: Weather, Commodity prices, Vision inspection, and sheets logs. Generating recommendation report...</p></div>';

        try {
            const response = await fetch('/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    session_id: sessionId,
                    new_message: {
                        parts: [{ text: "Generate a crop advisory recommendation fusion report." }]
                    }
                })
            });

            if (!response.ok) throw new Error("Advisory report compilation failed");
            const events = await response.json();
            const output = extractFinalOutput(events);
            resultDiv.innerHTML = `<div class="formatted-output">${formatMarkdown(output)}</div>`;
        } catch (err) {
            resultDiv.innerHTML = `<div style="color: #ef4444; padding: 2rem;">Error: ${err.message}</div>`;
        }
    });

    // Initial Logs Load
    loadLogs();
});

// Load Logs from sheets_mcp
async function loadLogs() {
    const container = document.getElementById('logs-container');
    container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading logged sheets...</div>';

    try {
        const response = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                session_id: sessionId,
                new_message: {
                    parts: [{ text: "Read rows from sheet crop_health." }]
                }
            })
        });

        if (!response.ok) throw new Error("Read logs failed");
        const events = await response.json();
        const output = extractFinalOutput(events);
        
        let logs = [];
        try {
            logs = JSON.parse(output);
        } catch (e) {
            container.innerHTML = `<div style="color: #94a3b8; text-align: center; padding: 2rem;">No logs found or invalid response formatting.</div>`;
            return;
        }

        if (!Array.isArray(logs)) {
            container.innerHTML = `<div style="color: #94a3b8; text-align: center; padding: 2rem;">No logs logged.</div>`;
            return;
        }

        container.innerHTML = '';
        logs.reverse().forEach(log => {
            const item = document.createElement('div');
            item.className = 'log-item';
            item.innerHTML = `
                <div class="log-meta">
                    <span class="log-tag">${log.sheet || 'crop_health'}</span>
                    <span>${log.timestamp || 'Just now'}</span>
                </div>
                <div class="log-title">${log.crop || 'Operation'} - ${log.status || log.action || 'Logged'}</div>
                <div class="log-notes">${log.notes || log.details || 'No additional details provided.'}</div>
            `;
            container.appendChild(item);
        });

        // Update dashboard logs count
        document.getElementById('dash-logs').textContent = `${logs.length} Active`;
    } catch (err) {
        container.innerHTML = `<div style="color: #ef4444; padding: 1rem;">Failed to fetch logs: ${err.message}</div>`;
    }
}

// Extract Final Output from events list
function extractFinalOutput(events) {
    if (!events || !events.length) return "No response from agent.";
    
    // Scan backwards to find the last event containing content or output
    for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.content && ev.content.parts) {
            const textParts = ev.content.parts.filter(p => p.text).map(p => p.text);
            if (textParts.length) return textParts.join('\n');
        }
        if (ev.output) {
            if (typeof ev.output === 'object') {
                return JSON.stringify(ev.output, null, 2);
            }
            return String(ev.output);
        }
    }
    return "No text response found in graph events.";
}

// A simple markdown formatter for rich aesthetics
function formatMarkdown(text) {
    if (!text) return "";
    
    // Replace headings
    let formatted = text
        .replace(/^### (.*$)/gim, '<h4 style="margin: 1rem 0 0.5rem 0; font-size: 1.1rem; color: #10b981;">$1</h4>')
        .replace(/^## (.*$)/gim, '<h3 style="margin: 1.5rem 0 0.75rem 0; font-size: 1.25rem; color: #f1f5f9; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.25rem;">$1</h3>')
        .replace(/^# (.*$)/gim, '<h2 style="margin: 2rem 0 1rem 0; font-size: 1.5rem; color: #fff;">$1</h2>');

    // Bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #fff; font-weight: 600;">$1</strong>');
    
    // Bullet points
    formatted = formatted.replace(/^\s*\*\s+(.*$)/gim, '<li style="margin-left: 1.25rem; margin-bottom: 0.4rem; color: #94a3b8;">$1</li>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}
