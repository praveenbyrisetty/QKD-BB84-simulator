from flask import Flask, request, jsonify
from flask_cors import CORS
import secrets
import hashlib
# qiskit imports are here if you want to expand later, 
# but for speed we use the secrets library logic below
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator

app = Flask(__name__)
# Allow requests from your React app
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

# --- HELPER FUNCTIONS ---
def generate_random_bits(n):
    return [secrets.randbelow(2) for _ in range(n)]

def generate_bases(n):
    return [secrets.choice(['+', 'x']) for _ in range(n)]

# --- API ROUTES ---

@app.route("/bb84", methods=["POST"])
def bb84_protocol():
    data = request.get_json()
    n_qubits = data.get("n", 20)
    eve_present = data.get("eve", False)
    
    # 1. Generate Alice's Qubits
    alice_bits = generate_random_bits(n_qubits)
    alice_bases = generate_bases(n_qubits)
    bob_bases = generate_bases(n_qubits)
    bob_results = []

    # 2. Simulate Transmission
    for i in range(n_qubits):
        current_bit = alice_bits[i]
        current_basis = alice_bases[i]
        
        # Eve Logic
        if eve_present:
            eve_basis = secrets.choice(['+', 'x'])
            if eve_basis == current_basis:
                eve_measured = current_bit
            else:
                eve_measured = secrets.randbelow(2)
            current_bit = eve_measured
            current_basis = eve_basis

        # Bob Logic
        if bob_bases[i] == current_basis:
            bob_measured = current_bit
        else:
            bob_measured = secrets.randbelow(2)
        bob_results.append(bob_measured)

    # 3. Sifting
    alice_key = []
    bob_key = []
    for i in range(n_qubits):
        if alice_bases[i] == bob_bases[i]:
            alice_key.append(alice_bits[i])
            bob_key.append(bob_results[i])
            
    # 4. Error Calculation
    errors = sum(1 for a, b in zip(alice_key, bob_key) if a != b)
    qber = errors / len(alice_key) if alice_key else 0
    aborted = qber > 0.15
    
    # 5. Privacy Amplification
    final_key = []
    if not aborted and len(alice_key) > 0:
        raw_key = "".join(str(b) for b in alice_key)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        # Convert first 8 hex chars to 32 bits (Extend this if you want longer keys!)
        # For Real OTP, we might want more bits. Let's take 64 bits (16 hex chars)
        final_key = [int(b) for b in format(int(key_hash[:16], 16), '064b')]

    # 6. Return Data
    return jsonify({
        "alice_bits": alice_bits,
        "alice_bases": alice_bases,
        "bob_bases": bob_bases,
        "bob_results": bob_results,
        "alice_key": alice_key,
        "qber": qber,
        "aborted": aborted,
        "final_key": final_key
    })

@app.route("/encrypt", methods=["POST"])
def encrypt():
    data = request.get_json()
    msg = data.get("message", "")
    key = data.get("key", [])
    
    if not key: 
        return jsonify({"error": "No Quantum Key generated yet!"}), 400

    # 1. Convert Message to Bits
    msg_bits = []
    for char in msg:
        msg_bits.extend([int(b) for b in format(ord(char), '08b')])
    
    # 2. STRICT SECURITY CHECK (Real BB84 / One-Time Pad Rule)
    # The Key MUST be at least as long as the message.
    if len(msg_bits) > len(key):
        return jsonify({
            "error": f"INSUFFICIENT KEY. Message requires {len(msg_bits)} bits, but Key is only {len(key)} bits."
        }), 400

    # 3. Strict XOR Encryption (No Wrapping)
    # We zip them, which naturally stops at the shortest length (but we checked length above)
    cipher_bits = [(msg_bits[i] ^ key[i]) for i in range(len(msg_bits))]
    
    # 4. Convert to Hex
    cipher_hex = hex(int("".join(str(b) for b in cipher_bits), 2))[2:].upper()
    
    return jsonify({
        "cipher_text": cipher_hex,
        "bits_used": len(msg_bits),
        "key_remaining": len(key) - len(msg_bits)
    })

@app.route("/decrypt", methods=["POST"])
def decrypt():
    data = request.get_json()
    cipher_hex = data.get("cipherText", "")
    key = data.get("key", [])
    
    if not key: return jsonify({"error": "No key"}), 400
    
    try:
        # 1. Hex to Bits
        cipher_int = int(cipher_hex, 16)
        cipher_bits = [int(b) for b in bin(cipher_int)[2:]]
        
        # Padding fix: Ensure we have full 8-bit bytes
        while len(cipher_bits) % 8 != 0: 
            cipher_bits.insert(0, 0)
            
        # 2. Strict XOR Decryption (No Wrapping)
        # We assume the key provided is the same one used for encryption
        plain_bits = []
        for i in range(len(cipher_bits)):
            if i < len(key):
                plain_bits.append(cipher_bits[i] ^ key[i])
            else:
                # This should technically not happen if Encrypt did its job
                break 

        # 3. Bits to Text
        chars = "".join([chr(int("".join(str(b) for b in plain_bits[i:i+8]), 2)) for i in range(0, len(plain_bits), 8)])
        
        return jsonify({"decrypted_message": chars})
    except Exception as e:
        print(f"Decryption error: {e}")
        return jsonify({"decrypted_message": "Decryption Error"})

if __name__ == "__main__":
    app.run(port=5000, debug=True)