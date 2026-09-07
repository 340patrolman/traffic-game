// QR 코드 생성기(바이트 모드 · 오류정정 M · 버전 1~7). 외부 라이브러리 0. 홍보 페이지(promo.html)의 게임 주소 QR 에 쓴다. jsQR 로 디코드 검증함.
TG.qr = (function () {
 var EC_M=[null,[1,26,16],[1,44,28],[1,70,44],[2,50,32],[2,67,43],[4,43,27],[4,49,31]]; /* [블록 수, 블록당 총 코드워드, 블록당 데이터 코드워드] */
 var ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38]];
 var FORMAT_M=[0x5412,0x5125,0x5E7C,0x5B4B,0x45F9,0x40CE,0x4F97,0x4AA0], VERINFO={7:0x07C94};
 var EXP=[],LOG=[]; (function(){ var x=1; for(var i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&0x100) x^=0x11D; } for(var j=255;j<512;j++) EXP[j]=EXP[j-255]; })();
 function gmul(a,b){ return (a===0||b===0)?0:EXP[LOG[a]+LOG[b]]; }
 function rsGen(n){ var g=[1]; for(var i=0;i<n;i++){ var ng=new Array(g.length+1).fill(0); for(var j=0;j<g.length;j++){ ng[j]^=g[j]; ng[j+1]^=gmul(g[j],EXP[i]); } g=ng; } return g; }
 function rsRemainder(data,gen){ var r=new Array(gen.length-1).fill(0); for(var i=0;i<data.length;i++){ var f=data[i]^r[0]; r.shift(); r.push(0); if(f) for(var j=0;j<gen.length-1;j++) r[j]^=gmul(gen[j+1],f); } return r; }
 function toBytes(s){ var u=unescape(encodeURIComponent(s)), a=[]; for(var i=0;i<u.length;i++) a.push(u.charCodeAt(i)); return a; }
 function encode(text){
  var bytes=toBytes(text), ver=0, spec;
  for(var v=1;v<=7;v++){ spec=EC_M[v]; if(spec[0]*spec[2]>=bytes.length+2){ ver=v; break; } }
  if(!ver) return null;
  var dataCap=spec[0]*spec[2], bits=[];
  function put(val,n){ for(var i=n-1;i>=0;i--) bits.push((val>>i)&1); }
  put(4,4); put(bytes.length,8); for(var b=0;b<bytes.length;b++) put(bytes[b],8);
  put(0,Math.min(4,dataCap*8-bits.length)); while(bits.length%8) bits.push(0);
  for(var pad=0xEC;bits.length<dataCap*8;pad^=0xEC^0x11) put(pad,8);
  var data=[]; for(var k=0;k<bits.length;k+=8){ var byte=0; for(var q=0;q<8;q++) byte=(byte<<1)|bits[k+q]; data.push(byte); }
  /* 블록 나누기 + RS 오류정정, 인터리브 */
  var nb=spec[0], ecLen=spec[1]-spec[2], gen=rsGen(ecLen), blocks=[], off=0;
  for(var bi=0;bi<nb;bi++){ var d=data.slice(off,off+spec[2]); off+=spec[2]; blocks.push({d:d,e:rsRemainder(d,gen)}); }
  var out=[]; for(var i=0;i<spec[2];i++) for(var j=0;j<nb;j++) out.push(blocks[j].d[i]); for(var i2=0;i2<ecLen;i2++) for(var j2=0;j2<nb;j2++) out.push(blocks[j2].e[i2]);
  /* 모듈 배치 */
  var size=ver*4+17, M=[], F=[]; for(var y=0;y<size;y++){ M.push(new Array(size).fill(0)); F.push(new Array(size).fill(false)); }
  function set(x,y,v){ M[y][x]=v?1:0; F[y][x]=true; }
  function finder(cx,cy){ for(var dy=-4;dy<=4;dy++) for(var dx=-4;dx<=4;dx++){ var x=cx+dx,y=cy+dy; if(x<0||y<0||x>=size||y>=size) continue; var dist=Math.max(Math.abs(dx),Math.abs(dy)); set(x,y,dist!==2&&dist!==4); } }
  finder(3,3); finder(size-4,3); finder(3,size-4);
  for(var t=0;t<size;t++){ if(!F[6][t]) set(t,6,t%2===0); if(!F[t][6]) set(6,t,t%2===0); }
  var ap=ALIGN[ver]; for(var ai=0;ai<ap.length;ai++) for(var aj=0;aj<ap.length;aj++){ var ax=ap[ai],ay=ap[aj]; if((ai===0&&aj===0)||(ai===0&&aj===ap.length-1)||(ai===ap.length-1&&aj===0)) continue; for(var dy2=-2;dy2<=2;dy2++) for(var dx2=-2;dx2<=2;dx2++) set(ax+dx2,ay+dy2,Math.max(Math.abs(dx2),Math.abs(dy2))!==1); }
  /* 형식 정보 자리(값은 마스크 결정 뒤) · 버전 정보 */
  for(var f=0;f<=8;f++){ if(f===6) continue; set(8,f,0); set(f,8,0); } for(var f2=0;f2<8;f2++){ set(size-1-f2,8,0); set(8,size-1-f2,0); } set(8,size-8,1);
  if(ver>=7){ var vi=VERINFO[ver]; for(var i3=0;i3<18;i3++){ var bit=(vi>>i3)&1, a=size-11+i3%3, b2=Math.floor(i3/3); set(a,b2,bit); set(b2,a,bit); } }
  /* 코드워드 지그재그 */
  var idx=0, total=out.length*8;
  for(var right=size-1;right>=1;right-=2){ if(right===6) right=5; for(var vert=0;vert<size;vert++){ for(var jj=0;jj<2;jj++){ var x=right-jj, up=((right+1)&2)===0, y=up?size-1-vert:vert; if(!F[y][x]){ var bitv=idx<total?(out[idx>>3]>>(7-(idx&7)))&1:0; M[y][x]=bitv; idx++; } } } }
  function maskAt(m,x,y){ switch(m){ case 0:return (x+y)%2===0; case 1:return y%2===0; case 2:return x%3===0; case 3:return (x+y)%3===0; case 4:return (Math.floor(x/3)+Math.floor(y/2))%2===0; case 5:return x*y%2+x*y%3===0; case 6:return (x*y%2+x*y%3)%2===0; default:return ((x+y)%2+x*y%3)%2===0; } }
  function applyMask(m){ for(var y=0;y<size;y++) for(var x=0;x<size;x++) if(!F[y][x]&&maskAt(m,x,y)) M[y][x]^=1; }
  function drawFormat(m){ var bitsF=FORMAT_M[m]; function fb(i){ return (bitsF>>i)&1; }
   for(var i=0;i<=5;i++) M[i][8]=fb(i); M[7][8]=fb(6); M[8][8]=fb(7); M[8][7]=fb(8); for(var i4=9;i4<15;i4++) M[8][14-i4]=fb(i4);
   for(var i5=0;i5<8;i5++) M[8][size-1-i5]=fb(i5); for(var i6=8;i6<15;i6++) M[size-15+i6][8]=fb(i6); M[size-8][8]=1; }
  function penalty(){ var p=0,y,x;
   for(y=0;y<size;y++){ var run=1; for(x=1;x<size;x++){ if(M[y][x]===M[y][x-1]){ run++; if(run===5) p+=3; else if(run>5) p++; } else run=1; } }
   for(x=0;x<size;x++){ var run2=1; for(y=1;y<size;y++){ if(M[y][x]===M[y-1][x]){ run2++; if(run2===5) p+=3; else if(run2>5) p++; } else run2=1; } }
   for(y=0;y<size-1;y++) for(x=0;x<size-1;x++){ var c=M[y][x]; if(c===M[y][x+1]&&c===M[y+1][x]&&c===M[y+1][x+1]) p+=3; }
   var pat=[1,0,1,1,1,0,1,0,0,0,0], pat2=pat.slice().reverse();
   for(y=0;y<size;y++) for(x=0;x<=size-11;x++){ var ok1=true,ok2=true; for(var k2=0;k2<11;k2++){ if(M[y][x+k2]!==pat[k2]) ok1=false; if(M[y][x+k2]!==pat2[k2]) ok2=false; } if(ok1||ok2) p+=40; }
   for(x=0;x<size;x++) for(y=0;y<=size-11;y++){ var ok3=true,ok4=true; for(var k3=0;k3<11;k3++){ if(M[y+k3][x]!==pat[k3]) ok3=false; if(M[y+k3][x]!==pat2[k3]) ok4=false; } if(ok3||ok4) p+=40; }
   var dark=0; for(y=0;y<size;y++) for(x=0;x<size;x++) dark+=M[y][x]; var pct=dark*100/(size*size), k5=Math.floor(Math.abs(pct-50)/5); p+=k5*10; return p; }
  var best=0,bestP=1e9;
  for(var m=0;m<8;m++){ applyMask(m); drawFormat(m); var sc=penalty(); if(sc<bestP){ bestP=sc; best=m; } applyMask(m); }
  applyMask(best); drawFormat(best);
  return { size:size, get:function(x,y){ return M[y][x]===1; }, version:ver, mask:best };
 }
 function draw(canvas,text,px){
  var q=encode(text); if(!q) return false;
  var quiet=4, n=q.size+quiet*2, s=Math.max(1,Math.floor(px/n)); canvas.width=canvas.height=n*s;
  var g=canvas.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,canvas.width,canvas.height); g.fillStyle='#111';
  for(var y=0;y<q.size;y++) for(var x=0;x<q.size;x++) if(q.get(x,y)) g.fillRect((x+quiet)*s,(y+quiet)*s,s,s);
  canvas.dataset.qrVersion=q.version; canvas.dataset.qrMask=q.mask; return true;
 }
 return { encode: encode, draw: draw };
})();
