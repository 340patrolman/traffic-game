document.querySelectorAll('.overlay,#hud,#pad,canvas').forEach(function(e){ if(e.id!=='EMB') e.style.display='none'; });
var old=document.getElementById('EMB'); if(old) old.remove();
var c=document.createElement('canvas'); c.id='EMB'; c.width=800; c.height=520;
c.style.cssText='position:fixed;left:0;top:0;z-index:2147483647;display:block';
document.documentElement.appendChild(c);
var g=c.getContext('2d');
// 어두운 바탕 + 밝은 바탕 두 곳에 올려 흰 배경이 남았는지 본다
g.fillStyle='#101828'; g.fillRect(0,0,400,520);
g.fillStyle='#e8eef7'; g.fillRect(400,0,400,520);
var t1=TG.tex.emblem(), t2=TG.tex.emblemEagle();
setTimeout(function(){
  g.drawImage(t1.image, 30, 30, 300, 300);
  g.drawImage(t2.image, 430, 60, 300, 240);
  g.fillStyle='#fff'; g.font='15px sans-serif'; g.fillText('shield / 어두운 바탕', 30, 360);
  g.fillStyle='#000'; g.fillText('eagle / 밝은 바탕', 430, 360);
  g.fillStyle='#fff'; g.fillText('t1 '+t1.image.width+'x'+t1.image.height, 30, 390);
  g.fillStyle='#000'; g.fillText('t2 '+t2.image.width+'x'+t2.image.height, 430, 390);
}, 500);
'drawn';
