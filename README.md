<<<<<<< HEAD
<div align="center">
  <h1 align="center"> GreenCode Analyzer</h1>
  <p align="center">
    <strong>Official User Manual & Operating Guide</strong>
    <br />
    <i>Provided by GILBERTO Systems</i>
  </p>
</div>

<br />

##  Introduction to GreenCode

Welcome to the GreenCode Analyzer. This tool is designed to help Python developers understand the hidden environmental cost of their algorithms. By analyzing your code's CPU operations and memory allocation, GreenCode estimates the real-world energy consumption (Joules and kWh) of your scripts.

---

##  1. Getting Started (Authentication)

To keep your execution history private, GreenCode requires a secure account.
1. Open the GreenCode application in your web browser.
2. If this is your first time, click **"Create Account"**. Enter a valid email address and a secure password.
3. If you already have an account, enter your credentials under the **"Login"** tab and click **"Enter Dashboard"**.

---

##  2. The Analyzer (Running Your Code)

The Analyzer is the core engine of the system. You have two ways to input your Python (`.py`) code:

### Method A: Live Execution Input
Best for testing quick algorithms or snippets.
1. Type or paste your Python code directly into the dark terminal window.
2. Click the green **RUN & ANALYZE** button below the text box.

### Method B: File Upload (Batch Processing)
Best for evaluating complete scripts or multiple files at once.
1. Drag and drop one or more `.py` files into the dashed **Dropzone** area, or click the button to browse your computer.
2. Once the files are loaded, click the green **RUN & ANALYZE** button.

###  Force Stop
If you accidentally write an infinite loop or a script that takes too long, a red pulsing **FORCE STOP** button will appear in the top navigation bar. Clicking this will kill the background execution safely and log the partial data.

---

##  3. Understanding Your Results

Once your code finishes executing, the dashboard will update with your telemetry data.

### The Metrics Table
* **Complexity (Ops):** The total number of mathematical and logical operations your CPU had to perform.
* **Peak Memory (B):** The maximum amount of RAM (in Bytes) your script required to run.
* **Total Joules (J):** The estimated kinetic energy cost of running the algorithm.
* **Total kWh:** The real-world electricity footprint.

### Real-Time Physics Model & Suggestions
Click on any row in the Analysis Results table to view its detailed breakdown:
* **The Chart:** Visualizes the CPU algorithmic load over time.
* **Suggestions Panel:** GreenCode's suggestions system will warn you about heavy memory allocations, O(n²) nested loops, or congratulate you for writing a "Green-Compliant Algorithm."
* Use the **Next (→)** and **Prev (←)** buttons to cycle through multiple uploaded files.

---

##  4. Managing Your History

GreenCode automatically saves every successful execution (and manual Force Stops) to your secure cloud vault.

1. Click the **My History** tab in the top navigation bar.
2. Your past executions are grouped neatly by Date and Time.
3. **Search:** Use the Search Bar in the top right corner to instantly filter your history for specific file names (e.g., type "quadratic" to find all tests run on your quadratic scripts).

---

##  5. Account Profile

1. Click the **Profile** tab in the top navigation bar.
2. Here you can verify your currently logged-in identity and email.
3. To update your security credentials, type a new password into the input box and click **Save Changes**. 

<br />

<div align="center">
  <i>For technical support or bug reports, please contact the GILBERTO Systems development team.</i>
</div>
=======
======================================================
GreenCode Analyzer
======================================================

PROJECT OVERVIEW
----------------
GreenCode Analyzer is a web-based, hardware-agnostic energy profiling tool developed by GILBERTO Systems. 
It utilizes Lexical Analysis and a Web Worker-isolated Pyodide (WebAssembly) engine 
to evaluate algorithmic Time Complexity (Ops) and Space Complexity (Peak Memory) 
of Python 3.x scripts. These metrics are then processed through a custom physics engine 
to estimate energy consumption in Joules and kWh. 

This project operates on a Serverless Architecture, utilizing Supabase (PostgreSQL) 
for secure cloud authentication and real-time database syncing.

PREREQUISITES
-------------
1. Visual Studio Code (with the "Live Server" extension installed)
2. A modern Web Browser (Google Chrome, Microsoft Edge, or Firefox)
3. A Supabase Account (Free Tier) for database hosting.

======================================================
STEP 1: FOLDER STRUCTURE SETUP
======================================================
Since this is a serverless application, there is no need for local PHP or Apache servers. 
Your project directory should look exactly like this:

GreenCode-by-Gilberto-Systems/
    ├── index.html          (Main dashboard & UI)
    ├── login.html          (Authentication & Registration)
    ├── app.js              (Frontend logic, Chart.js, & Supabase SDK)
    ├── worker.js           (Web Worker thread & Python WASM environment)
    └── pyodide_engine/     (Optional: local Pyodide files for offline parsing)

======================================================
STEP 2: SUPABASE CLOUD DATABASE SETUP
======================================================
We need to configure the PostgreSQL database and Row Level Security (RLS) in the cloud.

1. Go to https://supabase.com/ and create a new project.
2. Navigate to the "SQL Editor" on the left sidebar.
3. Paste the following schema to create the tables and security policies, then click "Run":

-- 1. Create Profiles Table (For Custom Usernames)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create History Table (For Analysis Results)
CREATE TABLE history (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    filename TEXT DEFAULT 'script.py',
    ops NUMERIC NOT NULL,
    peak_memory_bytes NUMERIC NOT NULL,
    energy_joules NUMERIC NOT NULL,
    energy_kwh NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

-- 4. Set Security Policies (Users can only see/insert their own data)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can view their own history" ON history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own history" ON history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Grant Permissions
GRANT ALL ON TABLE profiles TO anon, authenticated;
GRANT ALL ON TABLE history TO anon, authenticated;

======================================================
STEP 3: AUTHENTICATION CONFIGURATION
======================================================
To streamline testing and avoid Free-Tier email limits:
1. In your Supabase Dashboard, go to Authentication > Providers > Email.
2. Toggle "Confirm email" to OFF.
3. Go to Authentication > Rate Limits.
4. Increase the "Email rate limit" to prevent lockouts during rapid testing.

======================================================
STEP 4: CONNECTING THE FRONTEND
======================================================
1. In your Supabase Dashboard, go to Project Settings (the gear icon) > API.
2. Copy your Project URL and anon public API Key.
3. Open `app.js` and `login.html` in VS Code.
4. Paste your credentials into the configuration block at the top of both files:

const supabaseUrl = 'YOUR_URL_HERE';
const supabaseKey = 'YOUR_ANON_KEY_HERE';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

======================================================
STEP 5: RUNNING THE APPLICATION
======================================================
1. Open the project folder in Visual Studio Code.
2. Right-click on `login.html` and select "Open with Live Server".
   (Note: Opening the HTML file directly from your file explorer without a server may block the Web Worker due to browser CORS security policies).
3. Create an account, log in, and begin analyzing Python scripts!

TROUBLESHOOTING
---------------
- "Username taken or error saving profile": Ensure you ran the `GRANT ALL` SQL commands in Step 2 so the database allows new registrations to write to the profiles table.
- History Not Loading: Double-check that your browser's Developer Tools (Console) doesn't show any Supabase API key errors.
- Web Worker Fails to Boot: Ensure you are running the project through VS Code Live Server (`http://127.0.0.1:5500`) and not just a `file:///` path in your browser.
>>>>>>> 48dcb55666343b2214bfc555c739da488636077f
