"""Original 120 BPM instrumental pulse; no samples or third-party music."""
import math, wave, array, random
from pathlib import Path
rate=44100; seconds=25; samples=array.array('f',[0])*int(rate*seconds)
rng=random.Random(42)
def note(start,length,freq,amp,decay=5):
    offset=int(start*rate)
    for j in range(int(length*rate)):
        if offset+j>=len(samples):break
        t=j/rate
        env=min(1,t/.009)*math.exp(-decay*t)*min(1,(length-t)/.04)
        samples[offset+j]+=amp*env*(math.sin(2*math.pi*freq*t)+.22*math.sin(4*math.pi*freq*t))
def hz(m):return 440*2**((m-69)/12)
chords=[(45,57,60,64),(41,57,60,65),(48,55,60,64),(43,55,59,62)]
for bar in range(12):
    chord=chords[bar%4]; start=bar*2
    for n in chord[1:]:note(start,1.9,hz(n),.022,1.1)
    for beat in range(4):
        s=start+beat*.5
        note(s,.42,hz(chord[0]),.07,7)
        for j in range(int(.16*rate)):
            t=j/rate; i=int(s*rate)+j
            samples[i]+=.105*math.exp(-30*t)*math.sin(2*math.pi*(46*t+1.5*(1-math.exp(-35*t))))
    for step in range(8):
        s=start+step*.25
        note(s,.45,hz(chord[1+step%3]+12),.025 if step%2==0 else .015,9)
        for j in range(int(.035*rate)):
            t=j/rate; samples[int(s*rate)+j]+=.007*rng.uniform(-1,1)*math.exp(-100*t)
for f in [440,523.25,659.25]:note(19.65,2.5,f,.04,2)
out=array.array('h')
for i,x in enumerate(samples):
    t=i/rate; fade=min(1,t/.25,max(0,(25-t)/1.25))
    v=int(max(-.95,min(.95,x*fade))*32767);out.append(v);out.append(v)
with wave.open(str(Path(__file__).resolve().parent.parent/'assets/bed.wav'),'wb') as f:
    f.setparams((2,2,rate,0,'NONE','not compressed'));f.writeframes(out.tobytes())
