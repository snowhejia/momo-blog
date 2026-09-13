"""Original, deterministic ambient demo music. No sampled or third-party audio.
These two compositions and recordings are dedicated to CC0-1.0.
"""
import math, struct, wave
from pathlib import Path
RATE, SECONDS = 22050, 32
for filename, notes in [('cloud-notes.wav', [60,64,67,71,67,64,62,67,69,74,71,67]),('slow-morning.wav',[57,60,64,69,64,60,55,59,62,67,62,59])]:
    samples=[0.0]*(RATE*SECONDS)
    for beat in range(28):
        freq=440*2**((notes[beat%len(notes)]-69)/12)
        start=beat*.95
        for j in range(int(3*RATE)):
            t=j/RATE; i=int(start*RATE)+j
            if i>=len(samples): break
            envelope=(1-math.exp(-t*35))*math.exp(-t*2.0)
            tone=math.sin(2*math.pi*freq*t)+.24*math.sin(2*math.pi*freq*2*t)+.07*math.sin(2*math.pi*freq*3*t)
            samples[i]+=tone*envelope*.13
            echo=i+int(RATE*.31)
            if echo<len(samples):samples[echo]+=tone*envelope*.025
    data=bytearray()
    for i,value in enumerate(samples):
        fade=min(1,i/RATE/2,(len(samples)-i)/RATE/3)
        data+=struct.pack('<h',round(max(-1,min(1,value))*fade*32767))
    with wave.open(str(Path(__file__).parent/filename),'wb') as f:
        f.setparams((1,2,RATE,0,'NONE','not compressed'));f.writeframes(data)
