import "./App.css";
import { useState } from "react";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");

  // Handle login function
  async function handleLogin(e) {
    e.preventDefault();

    if (honeypot.trim() !== "") {
      alert("Bot detected");
      return;
    }

    try {
      const res = await fetch("http://localhost/Assaf_Media_Test/login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, honeypot, mode: "login" }),
      });

      const data = await res.json();
      console.log(data);

      if (data.success) {
        setLoginSuccess(true);
        setMessage("OTP has been sent to your email.");
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Network or server error.");
    }
  }

  // Verify OTP function
  async function handleVerifyOtp(e) {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost/Assaf_Media_Test/login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, otp, mode: "verify_otp" }),
        credentials: "include", // Include cookies
      });

      const data = await res.json();
      console.log(data);

      if (data.success) {
        setMessage("OTP verified! You are logged in.");

        // Navigate to the app
        window.location.href = "http://localhost/Assaf_Media_Test/";
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Network or server error.");
    }
  }

  // Resend OTP function
  async function handleResendOtp() {
    try {
      const res = await fetch("http://localhost/Assaf_Media_Test/login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, mode: "request_otp" }),
      });

      const data = await res.json();
      console.log(data);

      setMessage(data.message);
    } catch (err) {
      console.error(err);
      alert("Network or server error.");
    }
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Login</h1>

      {!loginSuccess ? (
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {/* Honeypot */}
          <input
            type="text"
            name="company"
            className="honeypot"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex="-1"
            autoComplete="off"
          />
          <button type="submit">Login</button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp}>
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button type="submit">Verify OTP</button>
          <button
            type="button"
            onClick={handleResendOtp}
            style={{ marginLeft: "1rem" }}
          >
            Resend OTP
          </button>
        </form>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}
