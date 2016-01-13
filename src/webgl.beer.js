(function () {

    var scene,
        renderer,
        container,
        stats,
        gui,
        axes,
        camera,
        ambientAdjust1,
        ambientAdjust2,
        riftEffect,
        sizeInvalidated = false,
        clock,
        maxAnisotropy;

    var width = window.innerWidth,
        height = window.innerHeight;

    var mouseX = 0,
        mouseY = 0,
        mouseXIndexed = 0,
        mouseYIndexed = 0,
        windowHalfX = width / 2,
        windowHalfY = height / 2,
        targetRotation = 0,
        targetRotationOnMouseDown = 0,
        mouseXOnMouseDown = 0;

    var canOrigin,
        canModel,
        canMeshes = [];

    // dat.GUI params
    var params = {
        'DragSpeed' : 0.008,
        'DragFriction' : 0.08,
        // 'OriginRotation' : -20,
        'OriginRotation' : -15,
        'LightIntensity' : 0.5,
        'DarkScene' : false,
        'RiftMode' : false,
    };




    function addGUI() {

        gui = new dat.GUI();

        gui.add(params, 'DragSpeed').min(0.001).max(0.1).step(0.001);
        gui.add(params, 'DragFriction').min(0.01).max(1).step(0.01);
        gui.add(params, 'OriginRotation').min(-90).max(90).step(1);
        gui.add(params, 'LightIntensity').min(0).max(1).step(0.01).listen();

        gui.add(params, 'DarkScene').onChange(onDarkSceneToggle);
        gui.add(params, 'RiftMode').onChange(onRiftModeToggle);

        // Hide by default
        dat.GUI.toggleHide();
        gui.domElement.style.display = "none";
    }

    function onDarkSceneToggle() {
        if ( params.DarkScene ) {
            $('body').removeClass('is-light');
            params.LightIntensity = 0.5;
        } else {
            $('body').addClass('is-light');
            params.LightIntensity = 1;
        }
    }

    function onRiftModeToggle() {
        if ( params.RiftMode ) { onEnableRift(); }
        else { onDisableRift(); }
    }

    function addStats() {

        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '0px';
        container.appendChild( stats.domElement );
    }

    function loadModel() {

        canOrigin = new THREE.Object3D();
        scene.add(canOrigin);

        var onProgress = function ( xhr ) {
            if ( xhr.lengthComputable ) {
                var percentComplete = xhr.loaded / xhr.total * 100;
                // console.log( Math.round(percentComplete, 2) + '% downloaded' );
                document.getElementById('loader').innerHTML = '<p>' + Math.round(percentComplete, 2) + '</p>';
            }
        };

        var onError = function ( xhr ) {
            console.log('onError...');
        };

        THREE.Loader.Handlers.add( /\.dds$/i, new THREE.DDSLoader() );

        var loader = new THREE.OBJMTLLoader();

        loader.load(
            'm/can.obj',
            'm/can.mtl',
            onLoadModelSuccess,
            onProgress,
            onError
        );

    }

    function onLoadModelSuccess(object) {

        canModel = object;
        canModel.rotation.y = Math.radians(-220);

        for ( var i = 0; i < canModel.children.length; i++ ) {

            var canMesh = canModel.children[i];

            canMeshes.push( canMesh );

            // Adjust 3D model to be centered down middle of can
            var offsetX = 0.2,
                offsetY = 0,
                offsetZ = 1.35;

            canMesh.applyMatrix( new THREE.Matrix4().makeTranslation( offsetX, offsetY, offsetZ ) ); // Values found through trial and error, specific to this 3D model.
            if ( canMesh.material.map ) {
                canMesh.material.map.anisotropy = maxAnisotropy;
            }
        }

        canModel.position.set(0, -30, 0);
        canOrigin.add( canModel );

        // $('#shadow').show();

        document.getElementById('loader').style.display = "none";

        // console.log( canModel );
    }




    /* THREE Initiate */
    function init() {

        // Scene
        scene = new THREE.Scene();

        // 3DModel
        loadModel();

        // GUI
        addGUI();

        // Renderer
        renderer = new THREE.WebGLRenderer({
            alpha : true,
            antialias : true
        });
        // setRendererSize();
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.setClearColor(0x000000, 1);

        maxAnisotropy = renderer.getMaxAnisotropy();
        // console.log('Max anisotrophy: ' + maxAnisotropy);

        // Container
        container = document.getElementById( "container" );
        container.appendChild( renderer.domElement );

        // Stats
        // addStats();

        // Create rift effect
        riftEffect = new THREE.OculusRiftEffect(renderer);

        // Axes
        axes = new THREE.AxisHelper( 10 );
        // scene.add(axes);

        // Camera
        camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 4000 );
        camera.position.set(0, -2, 80);

        // Lights
        var ambient = new THREE.AmbientLight();
        ambient.color.setRGB( 0.2, 0.2, 0.2 );

        ambientAdjust1 = new THREE.AmbientLight( 0x000000 );
        ambientAdjust2 = new THREE.AmbientLight( 0x000000 );
        scene.add( ambient, ambientAdjust1, ambientAdjust2 );

        var directionalLights = [
        //   color      intensity    x      y     z
            [0xffeedd,  0.7,         12,   10,   -3 ],
            [0xffeedd,  0.2,        -10,   20,    0 ],
            [0xffeedd,  0.15,       -45,  -50,    5 ]
        ];

        for ( var i = 0; i < directionalLights.length; i++ ) {

            var directionalLight = new THREE.DirectionalLight( directionalLights[i][0], directionalLights[i][1] );
            directionalLight.position.set( directionalLights[i][2], directionalLights[i][3], directionalLights[i][4] ).normalize();
            scene.add( directionalLight );
        }

        targetRotation = Math.radians(-170);

        // Move from dark to light scene at load (bg asset loading)
        params.DarkScene = false;
        onDarkSceneToggle();

        // Start animating
        animate();

        onResize();

    }

    /* THREE Render loop */
    function render() {

        // console.log( targetRotation );

        if ( canOrigin ) {
            canOrigin.rotation.z = Math.radians(params.OriginRotation);
            canOrigin.rotation.x += ( mouseYIndexed * 0.15 - canOrigin.rotation.x ) * 0.05;
        }

        if ( canModel ) {
            targetRotation += 0.0008;
            canModel.rotation.y += ( targetRotation - canModel.rotation.y ) * params.DragFriction;
            canModel.rotation.y += mouseXIndexed * 0.02;
        }

        ambientAdjust1.color.setRGB( 1 * params.LightIntensity, 1 * params.LightIntensity, 1 * params.LightIntensity );
        ambientAdjust2.color.setRGB( 1 * params.LightIntensity, 1 * params.LightIntensity, 1 * params.LightIntensity );

        camera.lookAt(scene.position);

        // Render scene
        if ( params.RiftMode === true ) {
            riftEffect.render( scene, camera );
        }
        else {
            renderer.render( scene, camera );
        }

        // Reset renderer size if it's been invalidated
        if ( sizeInvalidated === true ) {
            onResize();
            sizeInvalidated = false;
        }

    }



    // THREE Animate loop
    function animate() {

        requestAnimationFrame(animate);
        render();

        if ( stats ) {
            stats.update();
        }
    }



    /* Event helpers */
    function onResize() {

        windowHalfX = window.innerWidth / 2;
        windowHalfY = window.innerHeight / 2;

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize( window.innerWidth, window.innerHeight );
        riftEffect.setSize( window.innerWidth, window.innerHeight );
    }

    function onEnableRift() {
        // console.log("Oculus Rift mode - ENABLE!");
        sizeInvalidated = true;
    }

    function onDisableRift() {
        // console.log("Oculus Rift mode - DISABLE!");
        sizeInvalidated = true;
    }

    function onMouseMove( event ) {
        mouseX = ( event.clientX - windowHalfX );
        mouseY = ( event.clientY - windowHalfY );
        mouseYIndexed = ( ( mouseY / height ) * 2 );
        mouseXIndexed = ( ( mouseX / width ) * 2 );
    }

    function onDocumentMouseDown( event ) {

        event.preventDefault();

        document.addEventListener( 'mousemove', onDocumentMouseMove, false );
        document.addEventListener( 'mouseup', onDocumentMouseUp, false );
        document.addEventListener( 'mouseout', onDocumentMouseOut, false );

        mouseXOnMouseDown = mouseX;
        targetRotationOnMouseDown = targetRotation;
    }

    function onDocumentMouseMove( event ) {

        targetRotation = targetRotationOnMouseDown + ( mouseX - mouseXOnMouseDown ) * params.DragSpeed;
    }

    function onDocumentMouseUp( event ) {

        document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
        document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
        document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
    }

    function onDocumentMouseOut( event ) {

        document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
        document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
        document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
    }

    function onDocumentTouchStart( event ) {

        if ( event.touches.length == 1 ) {

            event.preventDefault();

            mouseXOnMouseDown = event.touches[ 0 ].pageX - windowHalfX;
            targetRotationOnMouseDown = targetRotation;
        }
    }

    function onDocumentTouchMove( event ) {

        if ( event.touches.length == 1 ) {

            event.preventDefault();

            mouseX = event.touches[ 0 ].pageX - windowHalfX;
            targetRotation = targetRotationOnMouseDown + ( mouseX - mouseXOnMouseDown ) * ( params.DragSpeed * 1.1 );
        }
    }

    document.addEventListener( 'mousedown', onDocumentMouseDown, false );
    document.addEventListener( 'touchstart', onDocumentTouchStart, false );
    document.addEventListener( 'touchmove', onDocumentTouchMove, false );

    document.addEventListener( 'mousemove', onMouseMove, false );

    /* Lightswitch */
    $('html').on('click touchstart', '.lightswitch', function () {
        if ( $(this).hasClass('toggle') ) {
            $(this).removeClass('toggle');
            params.DarkScene = false;
            onDarkSceneToggle();
        } else {
            $(this).addClass('toggle');
            params.DarkScene = true;
            onDarkSceneToggle();
        }
    });

    /* Info */
    $('html').on('click touchstart', '.info__button', function () {
        var $panel = $('.info');
        if ( $panel.hasClass('is-visible') ) {
            $panel.removeClass('is-visible');
        } else {
            $panel.addClass('is-visible');
        }
    });
    $('html').on('click touchstart', '.info__close', function () {
        $('.info').removeClass('is-visible');
    });
    $('html').on('touchend', '.info p a', function () {
        window.open( $(this).attr('href') );
    });

     /* Window bindings */
    // Resize canvas
    $(window).on('resize', function () {
        sizeInvalidated = true;
    });
    $(window).on('orientationchange', function () {
        // Get's overwritten by resize and pops back to correct size
        renderer.setSize(320, 480);
    });
    // Initiate project
    $(window).on('load', function () {
        init();
    });

    // ----------------------------------------
    // TOOLBOX
    // ----------------------------------------

    // Converts from degrees to radians.
    Math.radians = function(degrees) {
      return degrees * Math.PI / 180;
    };

    // Converts from radians to degrees.
    Math.degrees = function(radians) {
      return radians * 180 / Math.PI;
    };

})();