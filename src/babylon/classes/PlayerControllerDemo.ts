import GameManager from "../globals";

// ThirdPersonPlayerController ships in the @babylonjs-toolkit/dlc pack, which is
// loaded at runtime via the script bundle (see globals.ts) and is therefore NOT
// part of the UMD type definitions. Access it off the global TOOLKIT namespace.
export class PlayerControllerDemo extends TOOLKIT.GameModeController {

    constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}, alias: string = "PlayerControllerDemo") {
        super(transform, scene, properties, alias);
    }

    protected async createScene(data?: any): Promise<void> {
        // Load the player armature and create a third-person player controller
        GameManager.PostProgressStatus("Loading Player Armature ...");
        const playerPrefab = "playerarmature.gltf";
        const assetRepoPath = GameManager.PlaygroundRepo;
        const assetsManager = new BABYLON.AssetsManager(this.scene);
        assetsManager.addMeshTask("playerarmature", null, assetRepoPath, playerPrefab);
        await TOOLKIT.SceneManager.LoadRuntimeAssets(assetsManager, [playerPrefab], ()=> {
            const player = this.scene.getNodeByName("PlayerArmature") as BABYLON.TransformNode;
            if (player != null) {
                const controller = new PROJECT.ThirdPersonPlayerController(player, this.scene, { arrowKeyRotation: true, smoothMotionSpeed:true, smoothChangeRate: 25.0 });
                controller.enableInput = true;
                controller.attachCamera = true;
                controller.moveSpeed = 5.335;
                controller.walkSpeed = 2.0;
                controller.jumpSpeed = 12.0;
            }
        });
    }
}

TOOLKIT.SceneManager.RegisterClass("PlayerControllerDemo", PlayerControllerDemo);
