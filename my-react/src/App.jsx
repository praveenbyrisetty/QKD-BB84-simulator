import React, { useState } from 'react';

// ✅ FIX 1: Import CSS from the same folder (./ instead of ../)
import './index.css'; 

// ✅ FIX 2: Point to components inside the "Hack" folder
import Loader from './Hack/Loader'; 
import Header from './Hack/Header';
import QuantumChannel from './Hack/QuantumChannel';
import AlicePanel from './Hack/AlicePanel';
import BobPanel from './Hack/BobPanel';
import GraphPage from './Hack/GraphPage';
import Controls from './Hack/Controls';
import CascadePanel from './Hack/CascadePanel';
import PrivacyAmpPanel from './Hack/PrivacyAmpPanel';
import EncryptionPanel from './Hack/EncryptionPanel'; 

function App() {
  // --- STATE ---
  const [qubits, setQubits] = useState([]); 
  const [isEveOn, setIsEveOn] = useState(false);
  const [step, setStep] = useState(0); 
  
  const [numBits, setNumBits] = useState(20); 
  const [isLoading, setIsLoading] = useState(false); 

  // Backend Data
  const [backendData, setBackendData] = useState(null);
  const [finalKey, setFinalKey] = useState("");
  const [errorRate, setErrorRate] = useState(0);
  const [isAborted, setIsAborted] = useState(false);
  const [correctedKey, setCorrectedKey] = useState("");

  // --- ACTIONS ---

  const handleTransmit = async () => {
    setIsLoading(true);
    setStep(0);
    setBackendData(null);
    setQubits([]);
    setIsAborted(false);
    setErrorRate(0);
    setFinalKey("");
    setCorrectedKey("");

    try {
      const response = await fetch('http://127.0.0.1:5000/bb84', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: numBits, eve: isEveOn }),
      });

      const data = await response.json();
      setBackendData(data);

      const uiQubits = data.alice_bits.map((bit, i) => ({
        id: i,
        aliceBit: bit,
        aliceBasis: data.alice_bases[i],
        bobBasis: data.bob_bases[i],
        bobBit: data.bob_results[i], 
      }));

      setTimeout(() => {
        setQubits(uiQubits);
        setStep(1);
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error("Backend Error:", error);
      alert("⚠️ Error: Is your Python Backend running on port 5000?");
      setIsLoading(false);
    }
  };

  const handleSift = () => {
    if (!backendData) return;
    setErrorRate(backendData.qber * 100);
    setStep(2);
  };

  const handleCascade = () => {
    if (!backendData) return;
    if (backendData.aborted) {
      setIsAborted(true);
    }
    setCorrectedKey(backendData.alice_key ? backendData.alice_key.join('') : "");
    setStep(3);
  };

  const handlePrivacyAmp = () => {
    if (isAborted || !backendData) return;
    const keyStr = backendData.final_key.join('');
    setFinalKey(keyStr);
    setStep(4);
  };

  const handleReset = () => {
    setQubits([]); setStep(0); setIsAborted(false);
    setFinalKey(""); setErrorRate(0); setBackendData(null);
  };

  // --- RENDER ---
  return (
    <div>
      {isLoading && <Loader />}
      <Header isEveOn={isEveOn} setIsEveOn={setIsEveOn} step={step} />

      <main className="container">
        
        {/* STEP 0: CONFIG */}
        {step === 0 && !isLoading && (
          <div className="config-panel">
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:'500px'}}>
              <div style={{display:'flex', justifyContent:'space-between', width:'100%', marginBottom:'10px'}}>
                <span className="config-label">Transmission Size:</span>
                <span style={{color:'#6366f1', fontWeight:'bold', fontFamily:'monospace', fontSize:'1.1rem'}}>{numBits} Qubits</span>
              </div>
              <div className="range-wrapper">
                <input type="range" min="10" max="500" value={numBits} onChange={(e) => setNumBits(parseInt(e.target.value))} className="custom-range"/>
              </div>
            </div>
          </div>
        )}

        <section>
            <QuantumChannel isTransmitting={step >= 1 && !isAborted} qubits={qubits} />
        </section>
        
        <section className="split-view">
           <AlicePanel qubits={qubits} step={step} />
           <BobPanel qubits={qubits} step={step} />
        </section>

        {step >= 2 && (
          <section className={`stats-box ${isAborted ? 'aborted' : ''}`}>
             {isAborted ? (
               <div className="abort-container">
                 <div className="abort-icon">🚨</div>
                 <h2 className="abort-title">Protocol Aborted</h2>
                 <div className="abort-msg">Eavesdropper detected! Error Rate ({errorRate.toFixed(1)}%) too high.</div>
               </div>
             ) : (
               <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'30px', height:'420px'}}>
                 <div style={{height:'100%'}}>
                    <CascadePanel siftedQubits={qubits} />
                 </div>
                 <div style={{background:'rgba(15, 23, 42, 0.5)', borderRadius:'12px', border:'1px solid #334155', padding:'20px'}}>
                    <div style={{textAlign:'center', marginBottom:'10px'}}>QBER: {errorRate.toFixed(1)}%</div>
                    <GraphPage qubits={qubits} />
                 </div>
               </div>
             )}
          </section>
        )}

        {step >= 3 && !isAborted && (
          <section>
             <PrivacyAmpPanel finalKey={step >= 4 ? backendData.final_key : ""} correctedKey={correctedKey} />
          </section>
        )}

        {step >= 4 && !isAborted && (
          <section className="msg-area" style={{marginTop:'30px'}}>
            <h3 style={{textAlign:'center', color:'#6366f1', marginBottom:'20px'}}>Secure Messaging</h3>
            <EncryptionPanel finalKey={backendData.final_key} />
          </section>
        )}
      </main>

      <Controls step={step} actions={{ handleTransmit, handleSift, handleCascade, handlePrivacyAmp, handleReset }} />
    </div>
  );
}

export default App;