var start = true ;
var navstate = 0;
var pagestate = false;

function parax(id){
  
        var i1 = document.getElementById(id);

    window.addEventListener('mousemove',function(x){
        var pageX = x.clientX - window.innerWidth/2,
            pageY = x.clientY - window.innerHeight/2,
            pageXx = -1*(pageX/1800),
            pageYy = -1*(pageY/25);
        i1.style.transform = 
        'translateX('+ (pageXx) +'%) translateY(' + (pageYy) + '%)';
    });
}

function randomizer() {
    setInterval(function(){
        document.getElementById("c2").innerHTML = Math.floor(Math.random() * 10);
    }, 50);
    setInterval(function(){
        document.getElementById("c1").innerHTML = Math.floor(Math.random() * 10);
    }, 200);
}


function nopen(x){
    document.getElementById("nl1").style.transform = 'rotate(-135deg)';
    document.getElementById("nl2").style.transform = 'rotate(-45deg)';
    document.getElementById("nl1").style.width = '120%';
    document.getElementById("nl2").style.width = '120%';
    document.getElementById("nl3").style.width = '0%';
    document.getElementById("nl1").style.top = '25%';
    document.getElementById("nl2").style.top = '25%';
    document.getElementById("nl1").style.right = '-17.5%';
    if (x != -1) {
        navopen();
    }
}
function nclose() {
    document.getElementById("nl1").style.transform = 'initial';
    document.getElementById("nl2").style.transform = 'initial';
    document.getElementById("nl1").style.width = '100%';
    document.getElementById("nl2").style.width = '100%';
    document.getElementById("nl3").style.width = '80%';
    document.getElementById("nl1").style.top = '0%';
    document.getElementById("nl2").style.top = '50%';
    document.getElementById("nl1").style.right = '0';
    formpclose();
    navclose();
}
function nav(x) {
    if (navstate == 0) {
        nopen(x);
        navstate = 1;
    }
    else if (navstate == 1) {
        nclose();
        navstate = 0;
    }
}
function formp(){
    document.getElementById("formulacont").style.pointerEvents = 'none';
    document.getElementById("formp").style.clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)';
    document.getElementById("formcov").style.transform = 'rotate3d(0, 0, 0, 0)';
    document.getElementById("formcov").style.transition = '1s';
    document.getElementById("formbg").style.opacity = '0.1';
    document.getElementById("formtrack").style.opacity = '1';
    document.getElementById("formtrack").style.transition = '2s';
}

function formpclose(){
    document.getElementById("formulacont").style.pointerEvents = 'auto';
    document.getElementById("formp").style.clipPath = 'polygon(100% 71.9%, 100% 71.9%, 100% 100%, 0% 100%)';
    document.getElementById("formcov").style.transform = 'rotate3d(0, 180, 45, 180deg)';
    document.getElementById("formcov").style.transition = '1.35s';
    document.getElementById("formbg").style.opacity = '0';
    document.getElementById("formbg").style.transition = '1s';
    document.getElementById("formtrack").style.opacity = '0';
    document.getElementById("formtrack").style.transition = '0.8s';
}

function navopen(){
    document.getElementById("ni").style.visibility = 'visible';
    document.getElementById("ni").style.opacity = '0.7';
    document.getElementById("n1").style.top = '5vh';
    document.getElementById("n2").style.top = '11vh';
    document.getElementById("n3").style.top = '17vh';
    document.getElementById("n4").style.top = '23vh';
    document.getElementById("n5").style.top = '29vh';
}

function navclose() {
    document.getElementById("ni").style.visibility = 'hidden';
    document.getElementById("ni").style.opacity = '0';
    document.getElementById("n1").style.top = '0';
    document.getElementById("n2").style.top = '0';
    document.getElementById("n3").style.top = '0';
    document.getElementById("n4").style.top = '0';
    document.getElementById("n5").style.top = '0';
}
function pagein(x){
    document.getElementById("onhome").style.animationName = 'transio';
    document.getElementById("onhome").className = 'onhometransin';
    document.getElementById("onhomecont").style.visibility = 'hidden';
    document.getElementById("onhomedis").style.transition = '0.2s';
    document.getElementById("onhomedis").style.opacity = '0';
    document.getElementById("formp").style.height = '0';
    document.getElementById("formulahome").style.opacity = '0';
    document.getElementById("formulahome").style.visibility = 'hidden';
    document.getElementById("formp").style.visibility = 'hidden';
    document.getElementById("formulacont").style.visibility = 'hidden';
    document.getElementById("pager").className = 'pagerin';
    document.getElementById("pages").style.visibility = 'visible';
    document.getElementById("pages").style.opacity = '1';
    formpclose();
    if (x == 3) {
            document.getElementById(abg[ap]).play();
        } else {
            pause();
        }
    function pages(x){
        var hide = [2,3,4,5];
        document.getElementById(x).style.visibility = 'visible';
        document.getElementById(x).style.opacity = '1';
        hide.splice((x-2),1);
        for (var i = 0; i < 3; i++) {
            document.getElementById(hide[i]).style.visibility = 'hidden';
            document.getElementById(hide[i]).style.opacity = '0';
        }
    }
    pages(x);
    start = false;
    pagestate = true;
}
function pageout(){
    if (start != true) {
    document.getElementById("onhome").className = 'onhome';
    document.getElementById("onhome").style.animationName = 'transic';
    document.getElementById("onhomecont").style.visibility = 'visible';
    document.getElementById("onhomedis").style.transition = '2s';
    document.getElementById("onhomedis").style.opacity = '1';
    document.getElementById("formp").style.height = '200vh';
    document.getElementById("formulahome").style.opacity = '1';
    document.getElementById("formulahome").style.visibility = 'visible';
    document.getElementById("formp").style.visibility = 'visible';
    document.getElementById("formulacont").style.visibility = 'visible';
    document.getElementById("pager").className = 'pagerout';
    document.getElementById("pages").style.visibility = 'hidden';
    document.getElementById("pages").style.opacity = '0';
    pagestate = false;
    pause();
    }
}
var apage = ['a1','a2','a3'];
var abg = ['abg1','abg2','abg3']
var ap = 0;
var ape = 0;
function pause(){
    document.getElementById('abg1').pause();
    document.getElementById('abg2').pause();
    document.getElementById('abg3').pause();
}
function chngr(){
    if (ap > 2) {ap = 0;}
    if (ap < 0) {ap = 2;}
    if (ape > 2) {ape = 0;}
    if (ape < 0) {ape = 2;}
    document.getElementById(apage[ape]).style.animationName = 'fout';
    document.getElementById(apage[ape]).style.left = '100vw';
    document.getElementById(apage[ap]).style.animationName = 'fin';
    document.getElementById(apage[ap]).style.left = '0';
    pause();
    document.getElementById(abg[ap]).play();
}
function forward(){
    ap = ap+1;
    ape = ap-1; 
    chngr();
}
function back(){
    ap = ap-1;
    ape = ap+1; 
    chngr();
}
var quantity = [0,0,0,0,0,0,0,0,0,0];
function plus(x,y){
    quantity[y-1]++;
    document.getElementById(x).innerHTML = quantity[y-1];
    totalprice();
}
function minus(x,y){
    if ((quantity[y-1]) > 0) {
    quantity[y-1]--;
    document.getElementById(x).innerHTML = quantity[y-1];
    totalprice();
    }
}
function totalprice(){
    var total = (quantity[0]*1699) + (quantity[1]*1699) + (quantity[2]*1699) + (quantity[3]*1299) + (quantity[4]*1299) + (quantity[5]*899) + (quantity[6]*899) + (quantity[7]*899) + (quantity[8]*1299) + (quantity[9]*1299);
    document.getElementById('tprice').innerHTML = total + ".00php";
}
function promtxt(){
    window.alert('Order Received, Thank You for Ordering!!!');
}