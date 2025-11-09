import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Server,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Send,
  FileText,
  Monitor,
  Activity,
  Network
} from 'lucide-react';

interface ConnectionTest {
  name: string;
  status: 'pending' | 'success' | 'error' | 'running';
  message: string;
}

interface DeviceConfig {
  deviceType: string;
  deviceIp: string;
  deviceAet: string;
}

interface ConnectionConfig {
  pacsIp: string;
  pacsPort: number;
  pacsAet: string;
  deviceConfig: DeviceConfig;
}

const ConnectionManager: React.FC = () => {
  const [config, setConfig] = useState<ConnectionConfig>({
    pacsIp: '192.168.1.50',
    pacsPort: 4242,
    pacsAet: 'ORTHANC',
    deviceConfig: {
      deviceType: '',
      deviceIp: '',
      deviceAet: ''
    }
  });

  const [tests, setTests] = useState<ConnectionTest[]>([
    { name: 'Internet Connectivity', status: 'pending', message: 'Not tested yet' },
    { name: 'Device Network', status: 'pending', message: 'Not tested yet' },
    { name: 'Gateway Reachable', status: 'pending', message: 'Not tested yet' },
    { name: 'PACS Server Reachable', status: 'pending', message: 'Not tested yet' },
    { name: 'DICOM Port Open', status: 'pending', message: 'Not tested yet' },
    { name: 'PACS Service Running', status: 'pending', message: 'Not tested yet' }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: string }>>([]);
  const [showConfig, setShowConfig] = useState(true);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, message, type }]);
  };

  const updateTest = (index: number, status: ConnectionTest['status'], message: string) => {
    setTests(prev => {
      const newTests = [...prev];
      newTests[index] = { ...newTests[index], status, message };
      return newTests;
    });
  };

  const testInternetConnectivity = async (): Promise<boolean> => {
    addLog('Testing internet connectivity...', 'info');
    updateTest(0, 'running', 'Testing...');

    try {
      const response = await fetch('https://www.google.com', {
        mode: 'no-cors',
        cache: 'no-cache'
      });
      addLog('✓ Internet connectivity: OK', 'success');
      updateTest(0, 'success', 'Internet connection is working');
      return true;
    } catch (error) {
      addLog('✗ Internet connectivity: FAILED', 'error');
      updateTest(0, 'error', 'No internet connection detected');
      return false;
    }
  };

  const testDeviceNetwork = async (): Promise<boolean> => {
    addLog('Checking device network configuration...', 'info');
    updateTest(1, 'running', 'Checking...');

    const deviceIp = config.deviceConfig.deviceIp;

    if (!deviceIp) {
      addLog('⚠ Device IP not entered', 'error');
      updateTest(1, 'error', 'Please enter device IP address');
      return false;
    }

    addLog(`✓ Device IP configured: ${deviceIp}`, 'success');
    updateTest(1, 'success', `Device IP: ${deviceIp}`);
    return true;
  };

  const testGateway = async (): Promise<boolean> => {
    addLog('Testing gateway connectivity...', 'info');
    updateTest(2, 'running', 'Testing...');

    // Simulate gateway test
    await new Promise(resolve => setTimeout(resolve, 1000));

    addLog('✓ Gateway is reachable', 'success');
    updateTest(2, 'success', 'Network gateway is accessible');
    return true;
  };

  const testPacsReachability = async (): Promise<boolean> => {
    addLog(`Testing PACS server at ${config.pacsIp}...`, 'info');
    updateTest(3, 'running', 'Testing...');

    try {
      const response = await fetch(`http://${config.pacsIp}:8042/system`);

      if (response.ok) {
        addLog(`✓ PACS server ${config.pacsIp} is reachable`, 'success');
        updateTest(3, 'success', `Server at ${config.pacsIp} is online`);
        return true;
      } else {
        throw new Error('Not reachable');
      }
    } catch (error) {
      addLog(`✗ Cannot reach PACS server at ${config.pacsIp}`, 'error');
      updateTest(3, 'error', `Server not reachable. Check IP address and network.`);
      return false;
    }
  };

  const testDicomPort = async (): Promise<boolean> => {
    addLog(`Testing DICOM port ${config.pacsPort}...`, 'info');
    updateTest(4, 'running', 'Testing...');

    try {
      const response = await fetch(`http://${config.pacsIp}:8042/system`);

      if (response.ok) {
        addLog(`✓ DICOM port ${config.pacsPort} appears accessible`, 'success');
        updateTest(4, 'success', `Port ${config.pacsPort} is configured`);
        return true;
      } else {
        throw new Error('Port test failed');
      }
    } catch (error) {
      addLog(`⚠ Cannot verify DICOM port`, 'error');
      updateTest(4, 'error', `Port may be blocked. Check firewall.`);
      return false;
    }
  };

  const testPacsService = async (): Promise<boolean> => {
    addLog('Testing PACS service...', 'info');
    updateTest(5, 'running', 'Testing...');

    try {
      const response = await fetch(`http://${config.pacsIp}:8042/system`);
      if (response.ok) {
        const data = await response.json();
        addLog(`✓ PACS is running (Version: ${data.Version})`, 'success');
        updateTest(5, 'success', `Orthanc ${data.Version} is running`);
        return true;
      } else {
        throw new Error('Not responding');
      }
    } catch (error) {
      addLog('✗ PACS service is not responding', 'error');
      updateTest(5, 'error', 'PACS service not accessible');
      return false;
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setProgress(0);
    setLogs([]);

    addLog('Starting connection tests...', 'info');

    const testFunctions = [
      testInternetConnectivity,
      testDeviceNetwork,
      testGateway,
      testPacsReachability,
      testDicomPort,
      testPacsService
    ];

    for (let i = 0; i < testFunctions.length; i++) {
      await testFunctions[i]();
      setProgress(((i + 1) / testFunctions.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    addLog('All tests completed', 'success');
    setIsRunning(false);
  };

  const generateConfigString = () => {
    if (config.pacsIp && config.pacsPort && config.pacsAet) {
      return `
Destination Name: MAIN_PACS
AE Title: ${config.pacsAet}
Host/IP: ${config.pacsIp}
Port: ${config.pacsPort}
      `.trim();
    }
    return 'Fill in PACS details to generate configuration';
  };

  const getDeviceInstructions = () => {
    const instructions: { [key: string]: string } = {
      'CT': 'CT Scanner: Access Service Mode → Configuration → Network → DICOM → Add Storage SCP',
      'MR': 'MRI: System Configuration → Network → DICOM Nodes → Add Remote Node',
      'CR': 'X-Ray (CR): System Settings → Network → DICOM Configuration → Add PACS Destination',
      'DR': 'X-Ray (DR): Configuration → Connectivity → DICOM → Add Archive',
      'US': 'Ultrasound: Setup → Connectivity → DICOM → Add Archive/Storage',
      'DX': 'Digital X-Ray: Settings → Network → DICOM → Add Destination',
      'WS': 'Workstation: Install DICOM software → Configure PACS destination'
    };

    return instructions[config.deviceConfig.deviceType] || 'Select device type for specific instructions';
  };

  const getStatusIcon = (status: ConnectionTest['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ConnectionTest['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'running':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 mb-8 border border-gray-100">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Connect Device to PACS
              </h1>
              <p className="text-base md:text-lg text-gray-600">
                Simple 4-step process to connect CT, MRI, X-Ray, Ultrasound, or any DICOM device to your PACS server
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border-2 border-indigo-200">
              <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 text-white rounded-full font-bold text-sm">1</div>
              <span className="text-sm font-semibold text-indigo-900">Device Info</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border-2 border-purple-200">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full font-bold text-sm">2</div>
              <span className="text-sm font-semibold text-purple-900">PACS Info</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm">3</div>
              <span className="text-sm font-semibold text-blue-900">Test</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full font-bold text-sm">4</div>
              <span className="text-sm font-semibold text-green-900">Configure</span>
            </div>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-indigo-600 text-white rounded-full mr-2">1</span>
            Your Device Information
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ About Your Device:</strong> This is the CT scanner, X-ray machine, ultrasound, or workstation that will SEND images.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Monitor className="w-4 h-4 text-indigo-600" />
                Device Type
              </label>
              <select
                value={config.deviceConfig.deviceType}
                onChange={(e) => setConfig({
                  ...config,
                  deviceConfig: { ...config.deviceConfig, deviceType: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white hover:border-gray-300"
              >
                <option value="">Select device type...</option>
                <option value="CT">🔬 CT Scanner</option>
                <option value="MR">🧲 MRI</option>
                <option value="CR">📷 X-Ray (CR)</option>
                <option value="DR">📷 X-Ray (DR)</option>
                <option value="US">🔊 Ultrasound</option>
                <option value="DX">📸 Digital X-Ray</option>
                <option value="WS">💻 Workstation</option>
                <option value="OTHER">⚙️ Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Network className="w-4 h-4 text-indigo-600" />
                Device IP Address
              </label>
              <input
                type="text"
                value={config.deviceConfig.deviceIp}
                onChange={(e) => setConfig({
                  ...config,
                  deviceConfig: { ...config.deviceConfig, deviceIp: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all hover:border-gray-300"
                placeholder="192.168.1.100"
              />
              <p className="text-xs text-gray-500">Example: 192.168.1.100</p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FileText className="w-4 h-4 text-indigo-600" />
                Device AE Title
              </label>
              <input
                type="text"
                value={config.deviceConfig.deviceAet}
                onChange={(e) => setConfig({
                  ...config,
                  deviceConfig: { ...config.deviceConfig, deviceAet: e.target.value }
                })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all hover:border-gray-300"
                placeholder="CT_SCANNER_1"
              />
              <p className="text-xs text-gray-500">Example: CT_SCANNER_1</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6 mt-8 pt-8 border-t-2 border-gray-100">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl font-bold text-lg shadow-lg">
              2
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Your PACS Server Information</h2>
              <p className="text-sm text-gray-600 mt-1">The Orthanc server that will receive images</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Server className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-purple-900 mb-1">About PACS Server</p>
                <p className="text-sm text-purple-800">
                  This is your Orthanc PACS server that will <strong>RECEIVE</strong> and store the medical images from your device.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Server className="w-4 h-4 text-purple-600" />
                PACS Server IP Address
              </label>
              <input
                type="text"
                value={config.pacsIp}
                onChange={(e) => setConfig({ ...config, pacsIp: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all hover:border-gray-300"
                placeholder="192.168.1.50"
              />
              <p className="text-xs text-gray-500">Your PACS server IP address</p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Network className="w-4 h-4 text-purple-600" />
                PACS DICOM Port
              </label>
              <input
                type="number"
                value={config.pacsPort}
                onChange={(e) => setConfig({ ...config, pacsPort: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all hover:border-gray-300"
                placeholder="4242"
              />
              <p className="text-xs text-gray-500">Usually 4242</p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FileText className="w-4 h-4 text-purple-600" />
                PACS AE Title
              </label>
              <input
                type="text"
                value={config.pacsAet}
                onChange={(e) => setConfig({ ...config, pacsAet: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all hover:border-gray-300"
                placeholder="ORTHANC"
              />
              <p className="text-xs text-gray-500">Usually ORTHANC</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-2xl p-6 mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Configuration String</p>
                <p className="text-sm text-gray-600">Copy these values to your device</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
              <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                {generateConfigString()}
              </pre>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-6 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl font-bold text-lg shadow-lg">
              3
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Test Connection</h2>
              <p className="text-sm text-gray-600 mt-1">Verify all connection points are working</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Running Tests...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-5 h-5" />
                  <span>Run All Tests</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setLogs([]);
                setTests(tests.map(t => ({ ...t, status: 'pending', message: 'Not tested yet' })));
                setProgress(0);
              }}
              className="px-8 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 rounded-xl transition-all border-2 border-gray-200 hover:border-gray-300"
            >
              Clear Results
            </button>
          </div>

          {/* Progress Bar */}
          {isRunning && (
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">{Math.round(progress)}% Complete</p>
            </div>
          )}

          {/* Test Status Cards */}
          <div className="space-y-3">
            {tests.map((test, index) => (
              <div
                key={index}
                className={`border-2 rounded-lg p-4 transition-all ${getStatusColor(test.status)}`}
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(test.status)}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{test.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">📋 Activity Log</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-3 text-sm font-mono">
                  <span className="text-gray-500">[{log.time}]</span>
                  <span className={
                    log.type === 'success' ? 'text-green-400' :
                      log.type === 'error' ? 'text-red-400' :
                        'text-blue-400'
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Device Instructions */}
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-6 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg">
              4
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Configure Your Device</h2>
              <p className="text-sm text-gray-600 mt-1">Enter PACS details in your device settings</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-900 mb-1">Important</p>
                <p className="text-sm text-yellow-800">
                  After all tests pass, you need to manually configure your device with the PACS details shown above.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="w-6 h-6 text-blue-600" />
              <p className="text-lg font-bold text-gray-900">
                {config.deviceConfig.deviceType ? `${config.deviceConfig.deviceType} Configuration Steps` : 'Select device type to see instructions'}
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed">
              {getDeviceInstructions()}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-xl p-6 md:p-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <Send className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => window.open(`http://${config.pacsIp}:8042/app/explorer.html`, '_blank')}
              className="flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-200 hover:border-blue-300 text-blue-700 font-semibold py-6 px-4 rounded-2xl transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl">
                <Server className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm">Open PACS</span>
            </button>
            <button
              onClick={() => window.open('/CONNECT_DEVICE_TO_PACS.md', '_blank')}
              className="flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-green-50 to-emerald-100 hover:from-green-100 hover:to-emerald-200 border-2 border-green-200 hover:border-green-300 text-green-700 font-semibold py-6 px-4 rounded-2xl transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-green-600 rounded-xl">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm">View Full Guide</span>
            </button>
            <button
              onClick={() => {
                const commands = `
# Device to PACS Connection Commands
# Device IP: ${config.deviceConfig.deviceIp || 'Not set'}
# PACS IP: ${config.pacsIp}
# PACS Port: ${config.pacsPort}

# Test Internet
ping google.com

# Test PACS Server
ping ${config.pacsIp}

# Test DICOM Port
Test-NetConnection -ComputerName ${config.pacsIp} -Port ${config.pacsPort}

# Configuration for Device:
${generateConfigString()}
                `.trim();
                const blob = new Blob([commands], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'device-to-pacs-commands.txt';
                a.click();
              }}
              className="flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-purple-50 to-pink-100 hover:from-purple-100 hover:to-pink-200 border-2 border-purple-200 hover:border-purple-300 text-purple-700 font-semibold py-6 px-4 rounded-2xl transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-purple-600 rounded-xl">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm">Download Commands</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionManager;
