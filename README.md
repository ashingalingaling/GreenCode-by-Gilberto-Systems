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

