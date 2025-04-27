const FakeTerminal = ({ setIsAuthenticated }) => {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setOutput([
      "Connected to legacy system (v2.4.1)",
      "Warning: This system is scheduled for decommissioning",
      "Type 'help' for available commands",
      ""
    ]);
  }, []);

  const handleCommand = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;

    setIsProcessing(true);
    setOutput((prevOutput) => [...prevOutput, `$ ${command}`]);

    // Simulate command processing (for example, show output for 'help' command)
    let newOutput;
    if (command.toLowerCase() === "help") {
      newOutput = [
        "Available commands:",
        "help - Show this help message",
        "status - Check system status",
        "logs - Show latest logs",
      ];
    } else if (command.toLowerCase() === "status") {
      newOutput = ["System is operational", "No issues detected"];
    } else if (command.toLowerCase() === "logs") {
      newOutput = ["Fetching latest logs..."];
      // Fetch and display latest logs if necessary
    } else {
      newOutput = ["Command not found"];
    }

    setOutput((prevOutput) => [...prevOutput, ...newOutput, ""]);
    setIsProcessing(false);
    setCommand("");
  };

  return (
    <div className="terminal">
      <div className="output">
        {output.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </div>
      <form onSubmit={handleCommand} className="command-input">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          disabled={isProcessing}
          className="input-field"
          placeholder="Enter command..."
        />
        <button type="submit" disabled={isProcessing}>
          {isProcessing ? "Processing..." : "Run Command"}
        </button>
      </form>
    </div>
  );
};

export default FakeTerminal;