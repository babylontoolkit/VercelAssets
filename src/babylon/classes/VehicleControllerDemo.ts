import { AssetsManager, Quaternion, Scene, TransformNode } from "@babylonjs/core";
import { SceneController, InputController, SceneManager } from "@babylonjs-toolkit/next/scenemanager";
import { StandardCarController, VehicleInputController, VehicleCameraManager } from "@babylonjs-toolkit/next/project";
import GameManager from "../globals";

export class VehicleControllerDemo extends SceneController {

    constructor(transform: TransformNode, scene: Scene, properties: any = {}, alias: string = "VehicleControllerDemo") {
        super(transform, scene, properties, alias);
    }

    protected async createScene(data?: any): Promise<void> {
        // Load the rigged mustang and create a vehicle controller
        GameManager.PostProgressStatus("Loading Rigged Mustang ...");

        // Enable user input for the scene, if not already enabled by the scene
        InputController.EnableUserInput(this.scene.getEngine(), this.scene);

        // Load the rigged mustang and configure vehicle controller
        const mustangPrefab = "riggedmustang.gz.gltf";
        const assetRepoPath = GameManager.PlaygroundRepo;
        const assetsManager = new AssetsManager(this.scene);
        assetsManager.addMeshTask("riggedmustang", null, assetRepoPath, mustangPrefab);
        await SceneManager.LoadRuntimeAssets(assetsManager, [mustangPrefab], () => {
            const mustang = this.scene.getNodeByName("RiggedMustang") as TransformNode;
            if (mustang != null) {
                const startPosition = this.scene.getNodeByName("StartPosition 20") as TransformNode;
                if (startPosition != null) {
                    const startWorld = startPosition.getAbsolutePosition();
                    mustang.position.copyFrom(startWorld);
                    const startRotation = startPosition.absoluteRotationQuaternion;
                    if (startRotation != null) {
                        mustang.rotationQuaternion = startRotation.clone();
                    } else {
                        console.warn("VehicleControllerDemo: 'StartPosition 20' transform does not have a rotationQuaternion.");
                    }
                } else {
                    console.warn("VehicleControllerDemo: 'StartPosition 20' transform not found in scene.");
                }
                // Note: Car Should Start As Kinematic to prevent physics issues during initialization, such as the car
                // falling over or sliding around before the vehicle controller can be configured. Once the vehicle controller
                // is configured, we can switch to dynamic mode to allow the car to be driven.
                if (mustang.physicsBody != null) {
                    mustang.physicsBody.setMotionType(2); // Set to dynamic so that the vehicle controller can move the car
                }
                const standardCarController: StandardCarController = SceneManager.FindScriptComponent(mustang, "StandardCarController");
                if (standardCarController != null) {
                    standardCarController.topEngineSpeed = 220;
                    standardCarController.powerCoefficient = 2.0;
                }
                const vehicleInputController: VehicleInputController = SceneManager.FindScriptComponent(mustang, "VehicleInputController");
                if (vehicleInputController != null) {
                    vehicleInputController.enableInput = true;
                }
                const vehicleCameraManager: VehicleCameraManager = SceneManager.FindScriptComponent(mustang, "VehicleCameraManager");
                if (vehicleCameraManager != null) {
                    vehicleCameraManager.enableCamera = true;
                    vehicleCameraManager.autoAttachCamera = true;
                    vehicleCameraManager.followTarget = false;
                }
            }
        });
    }
}

SceneManager.RegisterClass("VehicleControllerDemo", VehicleControllerDemo);
