window.config = {
  routerBasename: '/',
  showStudyList: true,
  
  // Connect to YOUR Orthanc PACS
  servers: {
    dicomWeb: [
      {
        name: 'Orthanc',
        wadoUriRoot: 'http://localhost:8042/wado',
        qidoRoot: 'http://localhost:8042/dicom-web',
        wadoRoot: 'http://localhost:8042/dicom-web',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video,pdf',
        // Authentication if needed
        requestOptions: {
          // auth: 'orthanc:orthanc' // Uncomment if Orthanc has auth enabled
        }
      }
    ]
  },

  // Default extensions
  extensions: [],
  modes: [],
  
  // Hotkeys configuration
  hotkeys: [
    {
      commandName: 'incrementActiveViewport',
      label: 'Next Viewport',
      keys: ['right']
    },
    {
      commandName: 'decrementActiveViewport',
      label: 'Previous Viewport',
      keys: ['left']
    },
    {
      commandName: 'rotateViewportCW',
      label: 'Rotate Right',
      keys: ['r']
    },
    {
      commandName: 'rotateViewportCCW',
      label: 'Rotate Left',
      keys: ['l']
    },
    {
      commandName: 'flipViewportHorizontal',
      label: 'Flip Horizontal',
      keys: ['h']
    },
    {
      commandName: 'flipViewportVertical',
      label: 'Flip Vertical',
      keys: ['v']
    },
    {
      commandName: 'scaleUpViewport',
      label: 'Zoom In',
      keys: ['+']
    },
    {
      commandName: 'scaleDownViewport',
      label: 'Zoom Out',
      keys: ['-']
    },
    {
      commandName: 'fitViewportToWindow',
      label: 'Zoom to Fit',
      keys: ['=']
    },
    {
      commandName: 'resetViewport',
      label: 'Reset',
      keys: ['space']
    },
    {
      commandName: 'invertViewport',
      label: 'Invert',
      keys: ['i']
    },
    {
      commandName: 'nextImage',
      label: 'Next Image',
      keys: ['down']
    },
    {
      commandName: 'previousImage',
      label: 'Previous Image',
      keys: ['up']
    }
  ]
};
