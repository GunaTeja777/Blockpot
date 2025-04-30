# 🛡️ BlockPot AI

> A smart honeypot system that traps attackers, reads their behavior using AI + NLP, and securely logs everything on the blockchain.

---

## ❓ What Problem Does It Solve?

- 🔍 Real-time threat detection is challenging for security teams.
- 🧾 Traditional logs can be tampered with or deleted, risking loss of forensic evidence.
- 🧠 Analyzing hacker commands manually is slow and often cryptic.

---

## ⚙️ What Does BlockPot AI Do?

### 🪤 1. Deploys a Fake System (Honeypot)

- Simulates a vulnerable server (e.g., SSH or Web login).
- Captures all attacker actions: commands, access attempts, tool downloads.

### 🗣️ 2. Uses NLP to Understand Behavior

- Extracts meaning from attacker commands using spaCy / Transformers.
- Detects keywords like `wget`, `chmod`, `root`, `malware`.
- Identifies intentions such as:
  - Installing malware
  - Deleting system logs
  - Stealing credentials

### 🧠 3. Uses AI for Threat Classification

- A TensorFlow model classifies sessions as:
  - ✅ Safe
  - ⚠️ Suspicious
  - ❌ Malicious

### 🔐 4. Logs Everything on the Blockchain

- Records:
  - Attacker IP
  - Command
  - Threat level
  - Timestamp
- Stores logs immutably using Ethereum/Hyperledger.
- Ideal for digital forensics, audits, and compliance.

---

## 🖥️ What Does the User See?

- 🌐 Live feed of incoming attack attempts
- 🌍 Attacker IP & geo-location
- 🧾 NLP-based command summaries (e.g., "attempting to download malware")
- ⚠️ Threat level (Low / Medium / High)
- 🔗 Blockchain verification hash per log

---

## 💡 In One Line:

> A smart trap system that catches hackers, understands what they type using NLP, predicts their intent using ML, and stores it forever using Blockchain.

---

## 🚀 Technologies Used

| Tech | Purpose |
|------|---------|
| 🐍 Python | Backend + data processing |
| 🧠 TensorFlow | Threat classification model |
| 📜 NLP (spaCy / Transformers) | Command intent extraction |
| ⛓️ Ethereum / Hyperledger | Immutable log storage |
| 🐳 Docker | Honeypot environment |
| 🌐 React.js + Flask | Dashboard + API |

---

## 📂 Future Enhancements

- 🛠️ Custom rule engine for real-time flagging
- 📊 Threat heatmap visualization
- 🧪 Integrate with VirusTotal API for file analysis
- 📍 GeoIP tracking + dark mode dashboard

---

## 👨‍💻 Built For

- Hackathons  
- Cybersecurity competitions  
- AI + Blockchain showcases  
- Research & education in cyber forensics  

---

## 🚀 How to Impress Judges / Reviewers

✅ **Deploy a Fake SSH Server**  
Use Cowrie or a minimal SSH trap. Show how it logs every command and sends it to the ML classifier.

✅ **Real-time AI Analysis**  
Display live feedback on:
- Command typed (e.g., `wget virus.sh`)
- NLP summary: "Trying to download malware"
- ML output: `Malicious`
- Blockchain hash for proof

✅ **Interactive Live Demo**  
Show a live hacking session using terminal → watch results pop up on your dashboard instantly.

✅ **Bonus: Add Custom Rules & Alerts**  
Auto-flag dangerous commands like `rm`, `chmod`, `ssh`. Optionally trigger email/SMS alerts (can be mocked for demo).

✅ **Blockchain Explorer Integration**  
Show each log's blockchain hash using an explorer. Mention:  
> “Even if they wipe the system, the evidence remains forever.”

---

## 🧠 Judges Want... You Give Them...

| They Want... | You Deliver... |
|--------------|----------------|
| Real-world impact | SSH honeypot + NLP + Blockchain |
| ML/AI use | Real-time threat classification |
| Good UX | Live dashboard with clear logs |
| Innovation | Honeypot × AI × Blockchain combo |

---

## 📸 Screenshots (Optional)

_Add demo screenshots or terminal logs here to visually explain the system._

---

## 📜 License

MIT © 2025  Blockpot

---

