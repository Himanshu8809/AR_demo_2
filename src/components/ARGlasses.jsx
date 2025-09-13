import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";

const ARGlasses = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const faceGroupRef = useRef(new THREE.Group());
  const headModelRef = useRef(null);
  const glassesModelRef = useRef(null);
  const calibratedRef = useRef(false);
  const leftLegRef = useRef(null);
  const rightLegRef = useRef(null);

  const [status, setStatus] = useState("Initializing...");
  const [landmarks, setLandmarks] = useState(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [headModelLoaded, setHeadModelLoaded] = useState(false);
  const [showAR, setShowAR] = useState(false);
  const [selectedGlasses, setSelectedGlasses] = useState(null);
  const [showGlasses, setShowGlasses] = useState(false);

  // Smoothing variables for natural movement
  const lastPosition = useRef({ x: 0, y: 0, z: 0 });
  const lastRotation = useRef({ x: 0, y: 0, z: 0 });
  const lastScale = useRef(1);

  // Smoothing function for natural movement
  const smoothValue = (current, target, factor = 0.1) => {
    return current + (target - current) * factor;
  };

  const glassesOptions = [
    { id: "none", name: "No Glasses", color: "#transparent", price: 0 },
    { id: "classic", name: "Classic Black", color: "#000000", price: 99 },
    { id: "blue", name: "Blue Frame", color: "#0066cc", price: 129 },
    { id: "red", name: "Red Frame", color: "#cc0000", price: 119 },
    { id: "gold", name: "Gold Frame", color: "#ffd700", price: 199 },
    { id: "silver", name: "Silver Frame", color: "#c0c0c0", price: 149 },
  ];

  useEffect(() => {
    if (!showAR || !canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Disable shadows to avoid shader errors
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const camera = new THREE.OrthographicCamera(
      -w / 2,
      w / 2,
      h / 2,
      -h / 2,
      -1000,
      1000
    );
    camera.position.z = 10;
    cameraRef.current = camera;

    // Simplified lighting setup to avoid shader errors
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(2, 2, 2);
    scene.add(directionalLight);

    scene.add(faceGroupRef.current);
    // Ensure rotations apply yaw (Y), then pitch (X), then roll (Z)
    faceGroupRef.current.rotation.order = "YXZ";

 
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Update head and glasses every frame for smooth movement
      if (landmarks && headModelLoaded) {
        updateHeadAndGlasses(landmarks);
      }
      
      // Render every frame for smooth display
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
      
      
    };
    animate();

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.left = -window.innerWidth / 2;
      camera.right = window.innerWidth / 2;
      camera.top = window.innerHeight / 2;
      camera.bottom = -window.innerHeight / 2;
      camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [showAR, landmarks, modelLoaded, headModelLoaded]);

  useEffect(() => {
    if (!showAR) return;

    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.3,  // Lower for faster detection
      minTrackingConfidence: 0.3,   // Lower for faster tracking
    });

    faceMesh.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        setLandmarks(landmarks);
        setStatus("Tracking face...");
      } else {
        setStatus("No face detected");
        setLandmarks(null);
      }
    });

    const setupCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            try {
              await faceMesh.send({ image: videoRef.current });
            } catch (error) {
              console.error("FaceMesh error:", error);
            }
          },
          width: 640,
          height: 480,
          fps: 30,  // Set higher frame rate
        });
        camera.start();
      } else {
        // console.log("Video not ready, retrying in 100ms...");
        setTimeout(setupCamera, 100);
      }
    };

    setTimeout(setupCamera, 500);
  }, [showAR]);

  const updateHeadAndGlasses = (lm) => {
    if (!rendererRef.current || !rendererRef.current.domElement || !faceGroupRef.current) return;
  
    const W = rendererRef.current.domElement.clientWidth;
    const H = rendererRef.current.domElement.clientHeight;
  
    const videoW = videoRef.current?.videoWidth || 640;
    const videoH = videoRef.current?.videoHeight || 480;
    const videoScale = Math.max(W / videoW, H / videoH);
    const dispW = videoW * videoScale;
    const dispH = videoH * videoScale;
    const offX = (W - dispW) / 2;
    const offY = (H - dispH) / 2;
  
    const toPixel = (p) => ({
      x: offX + (1 - p.x) * dispW,
      y: offY + p.y * dispH,
      z: p.z,
    });
  
    const leftEye = toPixel(lm[33]);
    const rightEye = toPixel(lm[263]);
    const nose = toPixel(lm[1]);
    const leftEar = toPixel(lm[234]);
    const rightEar = toPixel(lm[454]);
  
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
      z: (leftEye.z + rightEye.z) / 2,
    };
    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  
    // ----- ROTATION -----
    const cx = eyeCenter.x;
    const cy = eyeCenter.y;
    const yaw = Math.atan2(nose.x - cx, eyeDist); // left/right
    const pitch = Math.atan2(nose.y - cy, eyeDist); // up/down
    let roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    roll = -roll + Math.PI;
  
    faceGroupRef.current.rotation.x = -pitch + Math.PI/7;
    faceGroupRef.current.rotation.y = -yaw;
    faceGroupRef.current.rotation.z = roll;
  
    // ----- POSITION -----
    const worldX = eyeCenter.x - W / 2 + yaw * 190; // move sideways with yaw
    const worldY = -(eyeCenter.y - H / 2);
    const noseZ = nose.z || 0;
    const distanceFactor = 0.02 + noseZ * 0.05;
  
    faceGroupRef.current.position.set(worldX, worldY, 0.1 * distanceFactor);
  
    // ----- SCALE -----
    const faceWidth = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);
    const scale = Math.max(0.1, Math.min(2.2, faceWidth / 240));
    faceGroupRef.current.scale.set(scale, scale, scale);
  
    // ----- GLASSES CALIBRATION -----
    if (glassesModelRef.current && !calibratedRef.current) {
      const gBox = new THREE.Box3().setFromObject(glassesModelRef.current);
      const gSize = new THREE.Vector3();
      gBox.getSize(gSize);
  
      const scaleFactor = (eyeDist / (gSize.x || 1)) * 1.2;
      glassesModelRef.current.scale.multiplyScalar(scaleFactor);
      glassesModelRef.current.position.set(0, -5, 0);
  
      glassesModelRef.current.traverse((child) => {
        if (child.isMesh) {
          child.material.transparent = false;
          child.material.opacity = 1.0;
        }
      });
  
      calibratedRef.current = true;
    }
  
     // Rendering handled by animation loop
  };
  
  const loadHeadModel = () => {
    const loader = new GLTFLoader();
    loader.load(
      "/head.glb",
      (gltf) => {
        const headModel = gltf.scene.clone();

        // Center the head model
        const box = new THREE.Box3().setFromObject(headModel);
        const center = new THREE.Vector3();
        box.getCenter(center);
        headModel.position.sub(center);
        // Ensure the head faces the camera - rotate 180° around Y to match face mesh direction
        headModel.rotation.set(0, Math.PI, 0);
        // headModel.scale.set(1,1,1);

        // Make head semi-transparent and hide any built-in glasses in the head model
        headModel.traverse((child) => {
          if (child.isMesh) {
            // Hide meshes that look like glasses inside the head model
            const n = (child.name || "").toLowerCase();
            if (
              n.includes("glass") ||
              n.includes("spectacle") ||
              n.includes("spec")
            ) {
              child.visible = false;
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => {
                  m.transparent = true;
                  m.opacity = 0.0; // Make head semi-transparent
                  m.depthWrite = true;
                });
              } else {
                child.material.transparent = true;
                child.material.opacity = 0.0; // Make head semi-transparent
                child.material.depthWrite = true;
              }
            }
          }
        });

        faceGroupRef.current.add(headModel);
        headModelRef.current = headModel;
        setHeadModelLoaded(true);
        setStatus("Head model loaded");
      },
      undefined,
      (err) => {
        console.error("Error loading head model:", err);
        setStatus("Error loading head model");
      }
    );
  };

  const handleGlassesSelect = (glasses) => {
    setSelectedGlasses(glasses);
    calibratedRef.current = false;
    if (glasses.id === "none") {
      setShowGlasses(false);
      if (glassesModelRef.current && faceGroupRef.current) {
        faceGroupRef.current.remove(glassesModelRef.current);
        glassesModelRef.current = null;
      }
    } else {
      setShowGlasses(true);
      createGlassesWithColor(glasses.color);
    }
  };

  const createGlassesWithColor = (color) => {
    // Remove previous glasses if exist
    if (glassesModelRef.current && faceGroupRef.current) {
      faceGroupRef.current.remove(glassesModelRef.current);
      glassesModelRef.current = null;
    }

    const loader = new GLTFLoader();
    loader.load(
      "/glasses.glb",
      (gltf) => {
        const model = gltf.scene.clone();

        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        // model.position.sub(center);

        model.traverse((child) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => {
                // material.color.setHex(color.replace("#", "0x"));
                // material.needsUpdate = true;
              });
            } else {
              // child.material.color.setHex(color.replace("#", "0x"));
              // child.material.needsUpdate = true;
            }
          }
        });
        console.log("Himanshu", model);

        // Ensure glasses draw in front of head
        // model.traverse((child) => {
        //   if (child.isMesh && child.material) {
        //     if (Array.isArray(child.material)) {
        //       child.material.forEach((m) => {
        //         m.depthTest = false;
        //         m.depthWrite = false;
        //       });
        //     } else {
        //       child.material.depthTest = false;
        //       child.material.depthWrite = false;
        //     }
        //     child.renderOrder = 999;
        //   }
        // });

        // Attach and keep a ref for dynamic fitting
        faceGroupRef.current.add(model);
        glassesModelRef.current = model;
        setModelLoaded(true);
        setStatus("Glasses loaded with color: " + color);
      },
      undefined,
      (err) => {
        console.log("No glasses.glb found, creating simple glasses...");
      }
    );
  };
  const startAR = () => {
    setShowAR(true);
    setStatus("AR Mode : Loading head model...");

    // Load head model first
    loadHeadModel();

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: "user",
          },
        })
        .then((stream) => {
          // console.log("Camera stream obtained:", stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              // console.log("Video metadata loaded");
              setStatus("Camera started - Move face into view");
            };
          }
        })
        .catch((err) => {
          // console.error("Camera access denied:", err);
          setStatus("Camera access denied - Please allow camera permission");
        });
    } else {
      setStatus("Camera not supported on this device");
    }

    setTimeout(() => {
      if (canvasRef.current) {
        setStatus("AR initialized - Move face into view");
      }
    }, 100);
  };

  const exitAR = () => {
    setShowAR(false);
    setHeadModelLoaded(false);
    setModelLoaded(false);
    if (faceGroupRef.current) {
      faceGroupRef.current.clear();
    }
    headModelRef.current = null;
    glassesModelRef.current = null;
    calibratedRef.current = false;
    setStatus("Select glasses to try on");
  };

  useEffect(() => {
    if (
      showAR &&
      headModelLoaded &&
      selectedGlasses &&
      selectedGlasses.id !== "none"
    ) {
      // console.log("Creating glasses with color:", selectedGlasses.color);
      createGlassesWithColor(selectedGlasses.color);
    } else if (showAR && selectedGlasses && selectedGlasses.id === "none") {
      // console.log("No glasses selected, clearing glasses");
      if (faceGroupRef.current) {
        const toRemove = faceGroupRef.current.children.filter(
          (_, idx) => idx > 0
        );
        toRemove.forEach((obj) => faceGroupRef.current.remove(obj));
      }
      setModelLoaded(false);
    }
  }, [showAR, selectedGlasses, headModelLoaded]);

  if (!showAR) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "20px",
          fontFamily: "system-ui, sans-serif",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            paddingBottom: "40px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1
              style={{
                color: "white",
                fontSize: "3rem",
                margin: "0 0 10px 0",
                textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
              }}
            >
              👓 Glasses Shop
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: "1.2rem",
                margin: "0",
              }}
            >
              Try on glasses with AR technology
            </p>
            {/* Debug info */}
          </div>

          {/* Glasses Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
              marginBottom: "40px",
            }}
          >
            {glassesOptions.map((glasses) => (
              <div
                key={glasses.id}
                onClick={() => {
                  console.log("Glasses card clicked:", glasses);
                  handleGlassesSelect(glasses);
                }}
                style={{
                  background: "white",
                  borderRadius: "15px",
                  padding: "20px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  border:
                    selectedGlasses?.id === glasses.id
                      ? "3px solid #667eea"
                      : "3px solid transparent",
                  boxShadow:
                    selectedGlasses?.id === glasses.id
                      ? "0 10px 30px rgba(102, 126, 234, 0.3)"
                      : "0 5px 15px rgba(0,0,0,0.1)",
                  transform:
                    selectedGlasses?.id === glasses.id
                      ? "translateY(-5px)"
                      : "translateY(0)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "50%",
                      background:
                        glasses.color === "#transparent"
                          ? "linear-gradient(45deg, #f0f0f0, #e0e0e0)"
                          : glasses.color,
                      margin: "0 auto 15px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2rem",
                      border:
                        glasses.color === "#transparent"
                          ? "2px dashed #ccc"
                          : "none",
                    }}
                  >
                    {glasses.color === "#transparent" ? "🚫" : "👓"}
                  </div>
                  <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>
                    {glasses.name}
                  </h3>
                  <p
                    style={{
                      margin: "0",
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      color: glasses.price === 0 ? "#666" : "#667eea",
                    }}
                  >
                    {glasses.price === 0 ? "Free" : `$${glasses.price}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* AR Button */}
          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => {
                console.log(
                  "AR button clicked, selectedGlasses:",
                  selectedGlasses
                );
                startAR();
              }}
              disabled={!selectedGlasses}
              style={{
                background: selectedGlasses
                  ? "linear-gradient(45deg, #667eea, #764ba2)"
                  : "#ccc",
                color: "white",
                border: "none",
                padding: "15px 40px",
                fontSize: "1.2rem",
                borderRadius: "50px",
                cursor: selectedGlasses ? "pointer" : "not-allowed",
                boxShadow: selectedGlasses
                  ? "0 5px 15px rgba(102, 126, 234, 0.4)"
                  : "none",
                transition: "all 0.3s ease",
              }}
            >
              {selectedGlasses ? "🚀 Try in AR" : "Select glasses first"}
            </button>
            {selectedGlasses && (
              <div
                style={{ color: "rgba(255,255,255,0.8)", marginTop: "10px" }}
              >
                <p style={{ margin: "0 0 5px 0" }}>
                  Selected: {selectedGlasses.name}
                </p>
                <p style={{ margin: "0", fontSize: "0.9rem", opacity: 0.8 }}>
                  Price:{" "}
                  {selectedGlasses.price === 0
                    ? "Free"
                    : `$${selectedGlasses.price}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // console.log("Rendering AR interface, showAR:", showAR, "selectedGlasses:", selectedGlasses);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
        }}
        onLoadedMetadata={() => {
          // console.log("Video loaded successfully");
          setStatus("Video loaded - Move face into view");
        }}
        onError={(e) => {
          // console.error("Video error:", e);
          setStatus("Video error - Please check camera permissions");
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />

      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          right: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "10px 20px",
            borderRadius: "25px",
            fontSize: "14px",
          }}
        >
          {status}
        </div>

        <button
          onClick={exitAR}
          style={{
            background: "rgba(255,255,255,0.9)",
            color: "#333",
            border: "none",
            padding: "10px 20px",
            borderRadius: "25px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          ← Back to Shop
        </button>
      </div>
    </div>
  );
};

export default ARGlasses;
