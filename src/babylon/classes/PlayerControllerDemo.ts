import { AssetsManager, Scene, TransformNode } from "@babylonjs/core";
import { SceneController, InputController, SceneManager } from "@babylonjs-toolkit/next/scenemanager";
import { ThirdPersonPlayerController } from "@babylonjs-toolkit/next/project";
import GameManager from "../globals";

export class PlayerControllerDemo extends SceneController {

    constructor(transform: TransformNode, scene: Scene, properties: any = {}, alias: string = "PlayerControllerDemo") {
        super(transform, scene, properties, alias);
    }

    protected async createScene(data?: any): Promise<void> {
        // Load the player armature and create a third-person player controller
        GameManager.PostProgressStatus("Loading Player Armature ...");

        // Enable user input for the scene, if not already enabled by the scene
        InputController.EnableUserInput(this.scene.getEngine(), this.scene);

        // Load the player armature and configure third-person player controller
        const playerPrefab = "playerarmature.gz.gltf";
        const assetRepoPath = GameManager.PlaygroundRepo;
        const assetsManager = new AssetsManager(this.scene);
        assetsManager.addMeshTask("playerarmature", null, assetRepoPath, playerPrefab);
        await SceneManager.LoadRuntimeAssets(assetsManager, [playerPrefab], ()=> {
            const player = this.scene.getNodeByName("PlayerArmature") as TransformNode;
            if (player != null) {
                const controller = new ThirdPersonPlayerController(player, this.scene, { arrowKeyRotation: true, smoothMotionSpeed:true, smoothChangeRate: 25.0 });
                controller.enableInput = true;
                controller.attachCamera = true;
                controller.moveSpeed = 5.335;
                controller.walkSpeed = 2.0;
                controller.jumpSpeed = 12.0;
            }
        });
    }
}

SceneManager.RegisterClass("PlayerControllerDemo", PlayerControllerDemo);
