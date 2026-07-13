import { FreeCamera, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { SceneController, SceneManager } from "@babylonjs-toolkit/next/scenemanager";

export class FreeCameraMode extends SceneController {
    private camera: FreeCamera | null = null;

    constructor(transform: TransformNode, scene: Scene, properties: any = {}, alias: string = "FreeCameraMode") {
        super(transform, scene, properties, alias);
    }

    protected destroy(): void {
        this.camera?.dispose();
        this.camera = null;
    }

    protected async createScene(data?: any): Promise<void> {
        // Create a free camera for the scene
        this.camera = new FreeCamera("FreeCamera", new Vector3(0, 5, -10), this.scene);
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas)this.camera.attachControl(canvas, true);
    }
}

SceneManager.RegisterClass("FreeCameraMode", FreeCameraMode);

