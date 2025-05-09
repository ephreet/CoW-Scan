# CoW-Scan
**🐄 CoW-Scan – Console Web Scanner Tool**

CoW-Scan (Console Web Scanner) is a lightweight web scanning tool designed to run directly from the browser's console. 

It is still pretty green and under *REALLY* lazy development, I started fiddling with it to have an aid in discovering hidden paths, mining parameters, and analyzing web responses with ease — when other *REAL* tools aren't available or not an option.



**🚀 Features**

✅ Path Discovery – Discover hidden paths using a customizable wordlist.

✅ Parameter Mining – Find GET parameters and analyze responses for differences.

✅ Depth Control – Customize crawl depth to fine-tune your scans.

✅ Custom Paths – Add custom paths for targeted discovery.




**🛠️ How to Use**

Open your browser's developer console (F12 or Ctrl + Shift + I).

Copy and paste the CoW-Scan script into the console.

**OR**

```
fetch('https://raw.githubusercontent.com/ephreet/CoW-Scan/refs/heads/main/cow-scan.js')
  .then(response => response.text())
  .then(script => eval(script))
  .catch(error => console.error('Failed to load CoW-Scan:', error));
```

Follow the on-screen menu to start scanning!


**🌐 Why CoW-Scan?**

Simple and fast — no installation required.

Directly leverages browser-based network capabilities.

Ideal for quick recon and web penetration testing.

