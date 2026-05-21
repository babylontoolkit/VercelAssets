export class VehicleControllerDemo extends TOOLKIT.GameModeController {

    constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}, alias: string = "VehicleControllerDemo") {
        super(transform, scene, properties, alias);
    }

    protected async createScene(data?: any): Promise<void> {
        // This get then rendering canvas from the engine
        const canvas = this.scene.getEngine().getRenderingCanvas();

        // This creates and positions a free camera (non-mesh)
        const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), this.scene);

        // This targets the camera to scene origin
        camera.setTarget(BABYLON.Vector3.Zero());

        // This attaches the camera to the canvas
        camera.attachControl(canvas, true);

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 0.7;

        // Our built-in 'sphere' shape.
        const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 2, segments: 32}, this.scene);

        // Move the sphere upward 1/2 its height
        sphere.position.y = 1;

        // Our built-in 'ground' shape.
        const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 6, height: 6}, this.scene);
    }
}

TOOLKIT.SceneManager.RegisterClass("VehicleControllerDemo", VehicleControllerDemo);
