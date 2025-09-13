import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

// Load OpenCV.js globally (include in public/index.html)
// <script async src="https://docs.opencv.org/4.5.5/opencv.js"></script>

const ARGlasses = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const faceGroupRef = useRef(null);

  const [showAR, setShowAR] = useState(true);

  // Init Three.js scene
  useEffect(() => {
    if (!showAR) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.z = 500;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 1, 1).normalize();
    scene.add(light);

    // Glasses container
    const faceGroup = new THREE.Group();
    scene.add(faceGroup);
    faceGroupRef.current = faceGroup;

    // Load glasses model
    const loader = new GLTFLoader();
    loader.load("/glasses.glb", (gltf) => {
      const glasses = gltf.scene;
      glasses.scale.set(100, 100, 100); // base scale
      faceGroup.add(glasses);
    });

    // Render loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
    };
  }, [showAR]);

  // Setup webcam + OpenCV face/eye detection
  useEffect(() => {
    if (!showAR) return;

    let video = videoRef.current;
    let cap;
    let faceCascade, eyeCascade;

    const updateHeadAndGlasses = (leftEye, rightEye) => {
      if (!faceGroupRef.current) return;

      const W = video.width;
      const H = video.height;

      // Midpoint between eyes
      const cx = (leftEye.x + rightEye.x) / 2;
      const cy = (leftEye.y + rightEye.y) / 2;

      // Eye distance
      const eyeDist = Math.hypot(
        rightEye.x - leftEye.x,
        rightEye.y - leftEye.y
      );

      // Position in scene (normalize to center)
      const worldX = cx - W / 2;
      const worldY = -(cy - H / 2);
      const worldZ = -220; // adjust for depth

      // Roll rotation
      const roll = -Math.atan2(
        rightEye.y - leftEye.y,
        rightEye.x - leftEye.x
      );

      // Base scale (when eyes are ~100px apart)
      const baseEyeDist = 100;
      const scale = eyeDist / baseEyeDist;

      faceGroupRef.current.position.set(worldX, worldY, worldZ);
      faceGroupRef.current.rotation.set(0, 0, roll);
      faceGroupRef.current.scale.setScalar(scale);
    };

    const runDetection = () => {
      let frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
      cap.read(frame);
      let gray = new cv.Mat();
      cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

      let faces = new cv.RectVector();
      faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0);

      if (faces.size() > 0) {
        let face = faces.get(0);
        let roiGray = gray.roi(face);

        let eyes = new cv.RectVector();
        eyeCascade.detectMultiScale(roiGray, eyes);

        if (eyes.size() >= 2) {
          const e1 = eyes.get(0),
            e2 = eyes.get(1);

          const eye1 = {
            x: face.x + e1.x + e1.width / 2,
            y: face.y + e1.y + e1.height / 2,
          };
          const eye2 = {
            x: face.x + e2.x + e2.width / 2,
            y: face.y + e2.y + e2.height / 2,
          };

          // Decide left vs right
          const leftEye = eye1.x < eye2.x ? eye1 : eye2;
          const rightEye = eye1.x < eye2.x ? eye2 : eye1;

          updateHeadAndGlasses(leftEye, rightEye);
        }

        eyes.delete();
        roiGray.delete();
      }

      frame.delete();
      gray.delete();
      faces.delete();

      requestAnimationFrame(runDetection);
    };

    video.onloadeddata = () => {
      cap = new cv.VideoCapture(video);
      faceCascade = new cv.CascadeClassifier();
      eyeCascade = new cv.CascadeClassifier();

      // Haar cascade files (you must put these in /public folder)
      faceCascade.load("haarcascade_frontalface_default.xml");
      eyeCascade.load("haarcascade_eye.xml");

      runDetection();
    };
  }, [showAR]);

  // Setup webcam stream
  useEffect(() => {
    if (!showAR) return;

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      })
      .catch((err) => console.error("Webcam error:", err));
  }, [showAR]);

  return (
    <div>
      <video
        ref={videoRef}
        width="640"
        height="480"
        style={{ display: "none" }}
      />
      <canvas ref={canvasRef} />
    </div>
  );
};

export default ARGlasses;
