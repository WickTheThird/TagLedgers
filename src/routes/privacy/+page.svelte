<svelte:head>
	<title>Privacy Policy - TagLedger</title>
</svelte:head>

<div class="legal">
	<h1>Privacy Policy</h1>
	<p class="updated">Last updated: March 29, 2026</p>

	<h2>1. Overview</h2>
	<p>TagLedger is a financial transaction management tool operated by BOI Staalberg SRL. This policy describes how we collect, use, and protect your data.</p>

	<h2>2. Data We Collect</h2>
	<ul>
		<li><strong>Google Account Info:</strong> Name, email address, and profile picture via Google OAuth for authentication.</li>
		<li><strong>Google Drive Access:</strong> We access your Google Drive to upload, list, and download Excel files in the designated TagLedger shared folder only.</li>
		<li><strong>Transaction Data:</strong> Financial data from uploaded Excel files is processed in your browser and is not stored on our servers.</li>
		<li><strong>Ledger Metadata:</strong> File names, upload timestamps, and uploader email are stored in a Google Sheet for file tracking.</li>
	</ul>

	<h2>3. How We Use Your Data</h2>
	<ul>
		<li>Authenticate you and manage your session</li>
		<li>Upload and retrieve your Excel files from Google Drive</li>
		<li>Parse and display transaction data in your browser</li>
		<li>Track which files have been uploaded by which user</li>
	</ul>

	<h2>4. Data Storage and Security</h2>
	<ul>
		<li>Session tokens are encrypted (AES-GCM) and stored in your browser's localStorage</li>
		<li>Google OAuth refresh tokens are stored only in your encrypted session</li>
		<li>Transaction data is processed client-side and never sent to our servers</li>
		<li>File metadata is stored in a private Google Sheet accessible only to authorized team members</li>
	</ul>

	<h2>5. Third-Party Services</h2>
	<ul>
		<li><strong>Google APIs:</strong> OAuth 2.0, Google Drive API, Google Sheets API</li>
		<li><strong>Cloudflare:</strong> Hosting and API infrastructure</li>
		<li><strong>Frankfurter API:</strong> Exchange rates from the European Central Bank (no personal data sent)</li>
	</ul>

	<h2>6. Data Sharing</h2>
	<p>We do not sell, trade, or share your personal data with third parties. Data is shared only within the authorized team members of your TagLedger organization.</p>

	<h2>7. Your Rights</h2>
	<p>You can revoke TagLedger's access to your Google account at any time via <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Google Account Permissions</a>. Contact us to request data deletion.</p>

	<h2>8. Contact</h2>
	<p>For privacy inquiries, contact: <a href="mailto:bumbufilip22@gmail.com">bumbufilip22@gmail.com</a></p>
</div>

<style>
	.legal {
		max-width: 720px;
		margin: 2rem auto;
		padding: 2rem;
		color: #e0e0e0;
		line-height: 1.7;
	}
	h1 { color: #fff; margin-bottom: 0.25rem; }
	h2 { color: #ddd; margin-top: 2rem; }
	.updated { color: #888; font-size: 0.9rem; }
	a { color: #60a5fa; }
	ul { padding-left: 1.5rem; }
	li { margin-bottom: 0.5rem; }
</style>
