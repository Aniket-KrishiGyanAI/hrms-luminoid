import React, { useState, useEffect } from "react";
import { Alert, Button, Container, Spinner } from "react-bootstrap";
import { Download, X, CheckCircle } from "react-feather";
import { toast } from "react-toastify";
import "./PWAInstallBanner.css";

const PWAInstallBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isAppleDevice = /iPad|iPhone|iPod/.test(ua);
    const isInStandaloneMode = window.navigator.standalone === true;

    setIsIOS(isAppleDevice);
    setIsInstalled(isInStandaloneMode);

    // Listen for beforeinstallprompt event (Android/Desktop Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      const dismissed = localStorage.getItem('pwa-install-dismissed');
      const timestamp = localStorage.getItem('pwa-install-dismissed-time');
      const daysSinceDismissal = timestamp
        ? (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60 * 24)
        : 0;

      if (!dismissed || daysSinceDismissal > 7) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setShowBanner(false);
      setIsInstalled(true);
      localStorage.removeItem('pwa-install-dismissed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle install button click
  const handleInstallClick = async () => {
    console.log("[PWA] Install clicked | deferredPrompt:", deferredPrompt);
    
    if (!deferredPrompt) {
      // No beforeinstallprompt event - show error
      console.error("[PWA] No deferredPrompt available. beforeinstallprompt event did not fire.");
      toast.error(
        "⚠️ Installation not available yet. Try:\n1. Ensure HTTPS connection\n2. Refresh page\n3. Check browser compatibility",
        {
          autoClose: 5000,
          closeButton: true,
        }
      );
      return;
    }

    setIsInstalling(true);
    console.log("[PWA] Showing install prompt...");
    
    // Show toast that installation is starting
    toast.info("📲 Opening installation...", {
      autoClose: 3000,
      closeButton: false,
    });

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      console.log("[PWA] User choice outcome:", outcome);

      if (outcome === "accepted") {
        console.log("[PWA] Installation accepted");
        setInstallSuccess(true);
        setIsInstalling(false);
        
        // Show success toast
        toast.success("✅ HRMS Luminoid is installing! Check your app drawer.", {
          autoClose: 4000,
          closeButton: false,
        });

        // Close banner after 2 seconds
        setTimeout(() => {
          setShowBanner(false);
        }, 2000);
      } else {
        console.log("[PWA] Installation declined");
        setIsInstalling(false);
        
        toast.warning("Installation cancelled.", {
          autoClose: 2000,
          closeButton: false,
        });
      }
    } catch (error) {
      console.error("[PWA] Installation error:", error);
      setIsInstalling(false);
      
      toast.error(`❌ Installation failed: ${error.message}`, {
        autoClose: 3000,
        closeButton: false,
      });
    }

    setDeferredPrompt(null);
  };

  // Handle banner close
  const handleClose = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", "true");
    localStorage.setItem("pwa-install-dismissed-time", Date.now().toString());
  };

  if (!showBanner || isInstalled) {
    return null;
  }

  return (
    <div className="pwa-install-banner-wrapper">
      <Container fluid className="pwa-install-banner">
        <Alert className="mb-0 pwa-alert" variant="success">
          <div className="d-flex align-items-center justify-content-between w-100">
            <div className="d-flex align-items-center flex-grow-1">
              <Download size={20} className="me-2 pwa-icon" />
              <div className="pwa-content">
                <strong className="pwa-title">
                  {isIOS
                    ? "📱 Add to Home Screen"
                    : "⬇️ Install HRMS Luminoid"}
                </strong>
                <small className="d-block text-muted pwa-subtitle">
                  {isIOS
                    ? 'Tap Share and select "Add to Home Screen" for offline access and faster performance'
                    : "Get instant access, work offline, and faster performance. No app store needed!"}
                </small>
              </div>
            </div>

            <div className="pwa-actions ms-3">
              {!isIOS && (
                <>
                  {installSuccess ? (
                    <Button
                      size="sm"
                      variant="success"
                      disabled
                      className="pwa-install-btn me-2 pwa-success-btn"
                    >
                      <CheckCircle size={16} className="me-2" />
                      Installing...
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={handleInstallClick}
                      disabled={isInstalling}
                      className="pwa-install-btn me-2"
                    >
                      {isInstalling ? (
                        <>
                          <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            role="status"
                            aria-hidden="true"
                            className="me-2"
                          />
                          Installing...
                        </>
                      ) : (
                        <>
                          <Download size={16} className="me-2" style={{display: 'inline'}} />
                          Install
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={handleClose}
                className="pwa-close-btn"
                disabled={isInstalling}
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        </Alert>
      </Container>
    </div>
  );
};

export default PWAInstallBanner;
