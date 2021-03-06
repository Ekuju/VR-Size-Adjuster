/**
 * Created by Trent on 5/28/2019.
 */

'use strict';

class VRGraphics {
    static render(t) {
        VRGraphics._stats.begin();

        VRGraphics._gl.clear(VRGraphics._gl.COLOR_BUFFER_BIT | VRGraphics._gl.DEPTH_BUFFER_BIT);

        if (VRGraphics._vrDisplay) {
            VRGraphics._vrDisplay.getFrameData(VRGraphics._frameData);

            if (VRGraphics._vrDisplay.isPresenting) {
                const leftViewMatrixScaled = mat4.create();
                VRGraphics.scaleEyesForHeight(leftViewMatrixScaled, VRGraphics._frameData.leftViewMatrix, VRGraphics._frameData.rightViewMatrix);

                const rightViewMatrixScaled = mat4.create();
                VRGraphics.scaleEyesForHeight(rightViewMatrixScaled, VRGraphics._frameData.rightViewMatrix, VRGraphics._frameData.leftViewMatrix);

                VRGraphics._gl.viewport(0, 0, VRGraphics._webGLCanvas.width * 0.5, VRGraphics._webGLCanvas.height);
                VRGraphics.getStandingViewMatrix(VRGraphics._viewMat, leftViewMatrixScaled);
                VRGraphics.renderSceneView(VRGraphics._frameData.leftProjectionMatrix, VRGraphics._viewMat, VRGraphics._frameData.leftViewMatrix, VRGraphics._frameData.pose);

                VRGraphics._gl.viewport(VRGraphics._webGLCanvas.width * 0.5, 0, VRGraphics._webGLCanvas.width * 0.5, VRGraphics._webGLCanvas.height);
                VRGraphics.getStandingViewMatrix(VRGraphics._viewMat, rightViewMatrixScaled);
                VRGraphics.renderSceneView(VRGraphics._frameData.rightProjectionMatrix, VRGraphics._viewMat, VRGraphics._frameData.rightViewMatrix, VRGraphics._frameData.pose);

                VRGraphics._vrDisplay.submitFrame();
            } else {
                VRGraphics._gl.viewport(0, 0, VRGraphics._webGLCanvas.width, VRGraphics._webGLCanvas.height);
                mat4.perspective(VRGraphics._projectionMat, Math.PI * 0.4, VRGraphics._webGLCanvas.width / VRGraphics._webGLCanvas.height, 0.1, 1024.0);
                VRGraphics.getStandingViewMatrix(VRGraphics._viewMat, VRGraphics._frameData.leftViewMatrix);
                VRGraphics.renderSceneView(VRGraphics._projectionMat, VRGraphics._viewMat, VRGraphics._frameData.leftViewMatrix, VRGraphics._frameData.pose);
                VRGraphics._stats.renderOrtho();
            }
        } else {
            // No VRDisplay found.
            VRGraphics._gl.viewport(0, 0, VRGraphics._webGLCanvas.width, VRGraphics._webGLCanvas.height);
            mat4.perspective(VRGraphics._projectionMat, Math.PI*0.4, VRGraphics._webGLCanvas.width / VRGraphics._webGLCanvas.height, 0.1, 1024.0);
            mat4.identity(VRGraphics._viewMat);
            mat4.translate(VRGraphics._viewMat, VRGraphics._viewMat, [0, -VRGraphics.PLAYER_HEIGHT, 0]);
            VRGraphics._cubeIsland.render(VRGraphics._projectionMat, VRGraphics._viewMat, VRGraphics._stats);
            VRGraphics._players.forEach(player => player.render(VRGraphics._projectionMat, VRGraphics._viewMat));
            VRGraphics._leftControllerModel.render(VRGraphics._projectionMat, VRGraphics._viewMat);
            VRGraphics._rightControllerModel.render(VRGraphics._projectionMat, VRGraphics._viewMat);

            VRGraphics._stats.renderOrtho();
        }

        VRGraphics._stats.end();
    }

    static loop(t) {
        if (VRGraphics._vrDisplay) {
            VRGraphics._vrDisplay.requestAnimationFrame(VRGraphics.loop);
        } else {
            window.requestAnimationFrame(VRGraphics.loop);
        }

        VRGraphics.render(t);
    }

    static createPlayers() {
        VRGraphics._players.push(new OBJModel(VRGraphics._gl, 'assets/models/ct.obj', [0.2, 0, -1], 2));
        VRGraphics._players.push(new OBJModel(VRGraphics._gl, 'assets/models/ct.obj', [1.2, 0, -1.7], 1.8));
        VRGraphics._players.push(new OBJModel(VRGraphics._gl, 'assets/models/ct.obj', [-0.8, 0, -0.7], 1.6764));
        VRGraphics._players.push(new OBJModel(VRGraphics._gl, 'assets/models/t.obj', [-0.4, 0, 1.2], 1.9));
        VRGraphics._players.push(new OBJModel(VRGraphics._gl, 'assets/models/t.obj', [-1.5, 0, 1.7], 1.70));
        VRGraphics._players.push(new OBJModel(VRGraphics._gl, 'assets/models/t.obj', [1.2, 0, 0.5], 1.79));
        VRGraphics._players.push(new OBJModel(VRGraphics._gl, 'assets/models/t.obj', [-1.25, 0, 0.43], 1.72));
    }

    static initWebGL(preserveDrawingBuffer) {
        const glAttribs = {
            alpha: false,
            preserveDrawingBuffer: preserveDrawingBuffer
        };
        const useWebGL2 = WGLUUrl.getBool('webgl2', false);
        const contextTypes = useWebGL2 ? ['webgl2'] : ['webgl', 'experimental-webgl'];
        for (let i in contextTypes) {
            VRGraphics._gl = VRGraphics._webGLCanvas.getContext(contextTypes[i], glAttribs);
            if (VRGraphics._gl) {
                break;
            }
        }
        if (!VRGraphics._gl) {
            const webGLType = (useWebGL2 ? 'WebGL 2' : 'WebGL');
            VRSamplesUtil.addError('Your browser does not support ' + webGLType + '.');
            return;
        }
        VRGraphics._gl.clearColor(0.1, 0.2, 0.3, 1.0);
        VRGraphics._gl.enable(VRGraphics._gl.DEPTH_TEST);
        VRGraphics._gl.enable(VRGraphics._gl.CULL_FACE);

        const textureLoader = new WGLUTextureLoader(VRGraphics._gl);
        const texture = textureLoader.loadTexture('assets/textures/cube-sea.png');

        // If the VRDisplay doesn't have stageParameters we won't know
        // how big the users play space. Construct a scene around a
        // default space size like 2 meters by 2 meters as a placeholder.
        VRGraphics._cubeIsland = new VRCubeIsland(VRGraphics._gl, texture, 4, 4);
        VRGraphics._leftControllerModel = new OBJModel(VRGraphics._gl, 'assets/models/left.obj', [0, 0, 0], 1);
        VRGraphics._rightControllerModel = new OBJModel(VRGraphics._gl, 'assets/models/right.obj', [0, 0, 0], 1);
        VRGraphics.createPlayers();

        const enablePerformanceMonitoring = WGLUUrl.getBool('enablePerformanceMonitoring', false);
        VRGraphics._stats = new WGLUStats(VRGraphics._gl, enablePerformanceMonitoring);
        VRGraphics._debugGeom = new WGLUDebugGeometry(VRGraphics._gl);

        // Wait until we have a WebGL context to resize and start rendering.
        window.addEventListener('resize', VRGraphics.onResize, false);
        VRGraphics.onResize();

        window.requestAnimationFrame(VRGraphics.loop);
    }

    static updateStage() {
        if (VRGraphics._vrDisplay) {
            if (VRGraphics._vrDisplay.stageParameters &&
                VRGraphics._vrDisplay.stageParameters.sizeX > 0 &&
                VRGraphics._vrDisplay.stageParameters.sizeZ > 0) {
                // If we have stageParameters with a valid size use that to resize
                // our scene to match the users available space more closely. The
                // check for size > 0 is necessary because some devices, like the
                // Oculus Rift, can give you a standing space coordinate but don't
                // have a configured play area. These devices will return a stage
                // size of 0.
                VRGraphics._cubeIsland.resize(VRGraphics._vrDisplay.stageParameters.sizeX, VRGraphics._vrDisplay.stageParameters.sizeZ);
            } else {
                if (VRGraphics._vrDisplay.stageParameters) {
                    VRSamplesUtil.addInfo('VRDisplay reported stageParameters, but stage size was 0. Using default size.', 3000);
                } else {
                    VRSamplesUtil.addInfo('VRDisplay did not report stageParameters', 3000);
                }
            }
        }
    }

    static onVRRequestPresent() {
        VRGraphics._vrDisplay.requestPresent([{source: VRGraphics._webGLCanvas}]).then(() => {}, err => {
            let errMsg = 'requestPresent failed.';
            if (err && err.message) {
                errMsg += '<br/>' + err.message;
            }
            VRSamplesUtil.addError(errMsg, 2000);
        });
    }

    static onVRExitPresent() {
        if (!VRGraphics._vrDisplay.isPresenting) {
            return;
        }

        VRGraphics._vrDisplay.exitPresent().then(() => {}, () => {
            VRSamplesUtil.addError('exitPresent failed.', 2000);
        });
    }

    static onVRPresentChange() {
        VRGraphics.onResize();

        if (VRGraphics._vrDisplay.isPresenting) {
            if (VRGraphics._vrDisplay.capabilities.hasExternalDisplay) {
                VRSamplesUtil.removeButton(VRGraphics._vrPresentButton);
                VRGraphics._vrPresentButton = VRSamplesUtil.addButton('Exit VR', 'E', 'assets/icons/cardboard64.png', VRGraphics.onVRExitPresent);
            }
        } else {
            if (VRGraphics._vrDisplay.capabilities.hasExternalDisplay) {
                VRSamplesUtil.removeButton(VRGraphics._vrPresentButton);
                VRGraphics._vrPresentButton = VRSamplesUtil.addButton('Enter VR', 'E', 'assets/icons/cardboard64.png', VRGraphics.onVRRequestPresent);
            }
        }

        VRGraphics.updateStage();
    }

    static getCurrentHeight(mat) {
        const translation = vec3.create();
        mat4.getTranslation(translation, VRGraphics._vrDisplay.stageParameters.sittingToStandingTransform);
        vec3.add(translation, translation, VRGraphics._frameData.pose.position);
        vec3.scale(translation, translation, -1);

        return (VRGraphics.VR_HEIGHT_ADD - translation[1]) * VRGraphics.FEET_PER_METER;
    }

    static onClick() {
        // Reset the background color to a random value
        VRGraphics._gl.clearColor(
            Math.random() * 0.5,
            Math.random() * 0.5,
            Math.random() * 0.5,
            1.0);
    }

    static getHeightScaleValue() {
        const realHeight = InputHandler.getRealHeight();
        const desiredHeight = InputHandler.getDesiredHeight();
        // subtracting add height first to account for eyes to top of head constant height
        // subtracting 1 bc this is going to be added relatively
        return (desiredHeight - VRGraphics.VR_HEIGHT_ADD) / (realHeight - VRGraphics.VR_HEIGHT_ADD) - 1;
    }

    static scaleEyesForHeight(out, eyeIn, otherEyeIn) {
        const scale = VRGraphics.getHeightScaleValue();

        const eyeRotationQuat = quat.create();
        mat4.getRotation(eyeRotationQuat, eyeIn);

        // I think these are both along the x axis only so I can probably not even subtract and just multiply the translation value by the scale
        const eyeTranslation = vec3.create();
        mat4.getTranslation(eyeTranslation, eyeIn);

        const otherEyeTranslation = vec3.create();
        mat4.getTranslation(otherEyeTranslation, otherEyeIn);

        const difference = vec3.create();
        vec3.subtract(difference, eyeTranslation, otherEyeTranslation);
        vec3.scale(difference, difference, 0.5 * scale); // were scaling each eye so only do half

        vec3.add(eyeTranslation, eyeTranslation, difference);
        mat4.fromRotationTranslation(out, eyeRotationQuat, eyeTranslation);
    }

    static scaleForHeight(out, mat) {
        const scale = VRGraphics.getHeightScaleValue();

        // scale head position
        const translation = vec3.create();
        mat4.getTranslation(translation, VRGraphics._vrDisplay.stageParameters.sittingToStandingTransform);
        vec3.add(translation, translation, VRGraphics._frameData.pose.position);
        vec3.scale(translation, translation, -scale);

        mat4.translate(out, mat, translation);
    }

    static getStandingViewMatrix(out, view) {
        if (VRGraphics._vrDisplay.stageParameters) {
            // If the headset provides stageParameters use the
            // sittingToStandingTransform to transform the view matrix into a
            // space where the floor in the center of the users play space is the
            // origin.
            const inverted = mat4.create();
            mat4.invert(inverted, VRGraphics._vrDisplay.stageParameters.sittingToStandingTransform);
            mat4.multiply(out, view, inverted);
        } else {
            // Otherwise you'll want to translate the view to compensate for the
            // scene floor being at Y=0. Ideally this should match the user's
            // height (you may want to make it configurable). For this demo we'll
            // just assume all human beings are 1.65 meters (~5.4ft) tall.
            mat4.identity(out);
            mat4.translate(out, out, [0, VRGraphics.PLAYER_HEIGHT, 0]);
            mat4.invert(out, out);
            mat4.multiply(out, view, out);
        }
    }

    static renderControllers(projection, view, unstandingView) {
        const controllers = [];
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad || !gamepad.pose || !gamepad.id) {
                continue;
            }

            if (gamepad.id.toLowerCase().includes('left')) {
                controllers[0] = gamepad;
            }
            if (gamepad.id.toLowerCase().includes('right')) {
                controllers[1] = gamepad;
            }
        }

        if (controllers.length === 0) {
            if (!VRGraphics._controllerAlertSent) {
                VRGraphics._controllerAlertSent = true;
                VRSamplesUtil.addError('Could not find a VR controller.', 2000);
                setTimeout(() => {
                    VRGraphics._controllerAlertSent = false;
                }, 4000);
            }

            return;
        }

        // NOTE: the controllers are rendered in view space or something so scaling isn't necessary

        if (controllers[0]) {
            const gamepadMat = mat4.create();
            mat4.fromRotationTranslation(gamepadMat, controllers[0].pose.orientation, controllers[0].pose.position);
            mat4.rotateY(gamepadMat, gamepadMat, Math.PI);

            // undo the view sittingToStandingTransform multiply
            mat4.multiply(gamepadMat, unstandingView, gamepadMat);

            VRGraphics._leftControllerModel.render(projection, gamepadMat);
        }
        if (controllers[1]) {
            const gamepadMat = mat4.create();
            mat4.fromRotationTranslation(gamepadMat, controllers[1].pose.orientation, controllers[1].pose.position);
            mat4.rotateY(gamepadMat, gamepadMat, Math.PI);

            // undo the view sittingToStandingTransform multiply
            mat4.multiply(gamepadMat, unstandingView, gamepadMat);

            VRGraphics._rightControllerModel.render(projection, gamepadMat);
        }
    }

    static renderSceneView(projection, view, originalView, pose) {
        VRGraphics.scaleForHeight(view, view);

        VRGraphics._players.forEach(player => player.render(projection, view));
        VRGraphics._cubeIsland.render(projection, view, VRGraphics._stats);

        VRGraphics.renderControllers(projection, view, originalView);

        // For fun, draw a blue cube where the players head would have been if
        // we weren't taking the stageParameters into account. It'll start in
        // the center of the floor.
        let orientation = pose.orientation;
        let position = pose.position;
        if (!orientation) {
            orientation = [0, 0, 0, 1];
        }
        if (!position) {
            position = [0, 0, 0];
        }

        VRGraphics._debugGeom.bind(projection, view);
        VRGraphics._debugGeom.drawCube(orientation, position, 0.2, [0, 0, 1, 1]);
    }

    static onResize() {
        if (VRGraphics._vrDisplay && VRGraphics._vrDisplay.isPresenting) {
            const leftEye = VRGraphics._vrDisplay.getEyeParameters('left');
            const rightEye = VRGraphics._vrDisplay.getEyeParameters('right');

            VRGraphics._webGLCanvas.width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
            VRGraphics._webGLCanvas.height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
        } else {
            VRGraphics._webGLCanvas.width = VRGraphics._webGLCanvas.offsetWidth * window.devicePixelRatio;
            VRGraphics._webGLCanvas.height = VRGraphics._webGLCanvas.offsetHeight * window.devicePixelRatio;
        }
    }

    static initialize() {
        VRGraphics._webGLCanvas = document.getElementById('webgl-canvas');
        VRGraphics._webGLCanvas.addEventListener('click', VRGraphics.onClick, false);

        if (navigator.getVRDisplays) {
            VRGraphics._frameData = new VRFrameData();

            navigator.getVRDisplays().then(displays => {
                if (displays.length > 0) {
                    VRGraphics._vrDisplay = displays[displays.length - 1];
                    VRGraphics._vrDisplay.depthNear = 0.1;
                    VRGraphics._vrDisplay.depthFar = 1024.0;

                    VRGraphics.initWebGL(VRGraphics._vrDisplay.capabilities.hasExternalDisplay);

                    VRGraphics.updateStage();

                    VRSamplesUtil.addButton('Reset Pose', 'R', null, () => {
                        VRGraphics._vrDisplay.resetPose();
                    });

                    if (VRGraphics._vrDisplay.capabilities.canPresent) {
                        VRGraphics._vrPresentButton = VRSamplesUtil.addButton('Enter VR', 'E', 'assets/icons/cardboard64.png', VRGraphics.onVRRequestPresent);
                    }

                    // For the benefit of automated testing. Safe to ignore.
                    if (VRGraphics._vrDisplay.capabilities.canPresent && WGLUUrl.getBool('canvasClickPresents', false)) {
                        VRGraphics._webGLCanvas.addEventListener('click', VRGraphics.onVRRequestPresent, false);
                    }

                    window.addEventListener('vrdisplaypresentchange', VRGraphics.onVRPresentChange, false);
                    window.addEventListener('vrdisplayactivate', VRGraphics.onVRRequestPresent, false);
                    window.addEventListener('vrdisplaydeactivate', VRGraphics.onVRExitPresent, false);
                } else {
                    VRGraphics.initWebGL(false);
                    VRSamplesUtil.addInfo('WebVR supported, but no VRDisplays found.', 3000);
                }
            });
        } else if (navigator.getVRDevices) {
            VRGraphics.initWebGL(false);
            VRSamplesUtil.addError('Your browser supports WebVR but not the latest version. See <a href=\'http://webvr.info\'>webvr.info</a> for more info.');
        } else {
            VRGraphics.initWebGL(false);
            VRSamplesUtil.addError('Your browser does not support WebVR. See <a href=\'http://webvr.info\'>webvr.info</a> for assistance.');
        }
    }
}

VRGraphics.PLAYER_HEIGHT = 0;
VRGraphics.VR_HEIGHT_ADD = 0.06940000344;
VRGraphics.FEET_PER_METER = 3.28084;

VRGraphics._vrDisplay = null;
VRGraphics._frameData = null;
VRGraphics._webGLCanvas = null;
VRGraphics._gl = null;
VRGraphics._stats = null;
VRGraphics._cubeIsland = null;
VRGraphics._debugGeom = null;
VRGraphics._viewMat = mat4.create();
VRGraphics._projectionMat = mat4.create();
VRGraphics._vrPresentButton = null;
VRGraphics._rightControllerModel = null;
VRGraphics._leftControllerModel = null;
VRGraphics._controllerAlertSent = false;

VRGraphics._players = [];