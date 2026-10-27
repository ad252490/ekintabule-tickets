# EKINTABULE Tickets – setup

1. **Firebase Console → Authentication → Sign-in method → Email/Password: enable.** Add two users:
   - `admin@ekintabule.app` – strong password (admin panel)
   - `gate@ekintabule.app` – password = the shared staff PIN (min 6 characters, e.g. 6–8 digits)
2. **Firestore → Rules:** paste `firestore.rules` and Publish. (Change the two emails there if you use different ones.)
3. Set your real site URL in `admin/admin.js` (`getVerifyUrl`, currently `https://YOUR-DOMAIN/verify/`).
4. Deploy (GitHub Pages is fine – HTTPS is required for the camera).
5. In Admin, **Generate Tickets again** – old tickets have no `qr` record and old QR codes won't work.
6. Staff: open `/gate/` on the phone → Add to Home Screen → enter PIN → Start Scanner.

To change the PIN: Authentication → gate user → reset password. Nothing else to redeploy.
