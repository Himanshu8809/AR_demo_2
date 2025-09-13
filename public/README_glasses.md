# Glasses Model

The application will automatically try to load `glasses.glb` from this public folder.

## How it works:
1. **Automatic loading**: The app first tries to load `/glasses.glb` from the public folder
2. **Fallback**: If no glasses.glb is found, it creates simple 3D glasses using Three.js geometry
3. **Custom upload**: You can still upload your own GLB/GLTF files using the file input

## To add your own glasses model:
1. Download a free 3D glasses model from sites like:
   - Sketchfab (free models)
   - TurboSquid (free models) 
   - CGTrader (free models)
2. Convert it to GLB format if needed
3. Place it in this public folder as `glasses.glb`

The application will work immediately with the built-in simple glasses, but you can replace it with a more detailed model anytime!
