import { Scene, TransformNode } from "@babylonjs/core";
import { SceneController, SceneManager } from "@babylonjs-toolkit/next/scenemanager";

export class DefaultGameMode extends SceneController {
    
    constructor(transform: TransformNode, scene: Scene, properties: any = {}, alias: string = "DefaultGameMode") {
        super(transform, scene, properties, alias);
    }

    protected awake(): void {
        /* Init component function */
    }

    protected start(): void {
        /* Start component function */
    }

    protected ready(): void {
        /* Execute when ready function */
    }

    protected update(): void {
        /* Update render loop function */
    }

    protected late(): void {
        /* Late update render loop function */
    }

    protected step(): void {
        /* Before physics step function (remove empty function for performance) */
    }

    protected fixed(): void {
        /* After physics step function (remove empty function for performance) */
    }

    protected after(): void {
        /* After update render loop function */
    }

    protected reset(): void {
        /* Reset component function */
    }

    protected destroy(): void {
        /* Destroy component function */
    }

    protected async createScene(data?: any): Promise<void> {
        /* Create scene content here */
    }
}

SceneManager.RegisterClass("DefaultGameMode", DefaultGameMode);
