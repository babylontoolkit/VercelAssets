export class FreeCameraMode extends TOOLKIT.GameModeController {
    private camera: BABYLON.FreeCamera | null = null;

    constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}, alias: string = "FreeCameraMode") {
        super(transform, scene, properties, alias);
    }

    protected destroy(): void {
        this.camera?.dispose();
        this.camera = null;
    }

    protected async createScene(data?: any): Promise<void> {
        // Create a free camera for the scene
        this.camera = new BABYLON.FreeCamera("FreeCamera", new BABYLON.Vector3(0, 5, -10), this.scene);
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas)this.camera.attachControl(canvas, true);
    }
}

TOOLKIT.SceneManager.RegisterClass("FreeCameraMode", FreeCameraMode);

