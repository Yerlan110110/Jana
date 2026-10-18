from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
ROOT=Path(__file__).resolve().parents[2]
pdfmetrics.registerFont(TTFont('R','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('B','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
C=canvas.Canvas(str(ROOT/'docs/defense/JanaMen-defense.pdf'),pagesize=(1600,1000),invariant=True)
C.setTitle('JanaMen | До публикации')
INK='#17211b'; PAPER='#f6f4eb'; GREEN='#007a00'; MINT='#c9efc4'
def rect(x,y,w,h,color):
 C.setFillColor(HexColor(color));C.rect(x,y,w,h,fill=1,stroke=0)
def text(x,y,s,size=28,color=INK,bold=False):
 C.setFillColor(HexColor(color));C.setFont('B' if bold else 'R',size);C.drawString(x,y,s)
def footer(n,dark=False):
 color=MINT if dark else '#60685f';text(80,43,'Демонстрационные данные · Jana Post × Terricon Valley · 18.10.2026',17,color);text(1450,43,f'{n} / 3',17,color)
rect(0,0,1600,1000,INK);rect(0,0,22,1000,GREEN)
text(80,902,'JanaMen',33,MINT,True);text(1160,902,'DIGITAL HR / 2026',20,MINT)
text(74,345,'26',300,MINT,True)
text(650,720,'Одна настройка.',60,PAPER,True)
text(650,615,'Сотрудники',55,PAPER,True)
text(650,540,'потеряли бы',55,PAPER,True)
text(650,465,'доступ.',55,PAPER,True)
rect(650,355,780,3,GREEN);text(650,300,'Мы видим последствия',35,MINT);text(650,250,'до публикации.',35,MINT)
text(80,130,'Синтетический сценарий. Черновик не опубликован.',25,PAPER)
footer(1,True);C.showPage()
rect(0,0,1600,1000,PAPER);text(80,900,'Проверить изменение. До того, как оно станет правилом.',43,INK,True)
text(80,660,'29',165,INK,True);text(395,690,'→',110,GREEN);text(580,660,'3',165,GREEN,True)
text(85,600,'сотрудников с доступом: сейчас → после публикации',27)
rect(1010,620,510,190,MINT);text(1050,740,'3 вопроса',42,GREEN,True);text(1050,680,'потеряют источник',29)
text(80,530,'Результат кнопки «Сравнить ответы» на публичном стенде.',26)
shot=ROOT/'docs/defense/assets/public-impact.png';image=ImageReader(str(shot));iw,ih=image.getSize();w=1440;h=ih*w/iw
C.saveState();p=C.beginPath();p.rect(80,150,1440,320);C.clipPath(p,stroke=0);C.drawImage(image,80,470-h,width=w,height=h);C.restoreState()
text(80,95,'Репетиция сохранённого черновика. Люди и регламент вымышлены.',21)
footer(2);C.showPage()
rect(0,0,1600,1000,MINT);text(80,900,'Один кабинет. Три роли. Общий процесс.',52,INK,True)
for x,title,line1,line2 in [(80,'Сотрудник','Заявки · обучение','Ответы с источниками'),(580,'Руководитель','Очередь команды','Согласование и прогресс'),(1080,'HR','Публикации · обращения','Проверка черновика')]:
 rect(x,610,440,190,PAPER);text(x+28,740,title,35,INK,True);text(x+28,680,line1,24);text(x+28,640,line2,24)
text(80,535,'React  →  Django API  →  PostgreSQL',42,INK,True)
text(80,480,'Адаптеры 1С и Documentolog — демонстрационные. Реальные коннекторы — следующий этап.',23)
rect(80,350,1440,2,GREEN)
for x,n,label in [(80,'255','тестов PostgreSQL'),(590,'22','сценария ролей'),(1100,'10','клавиатурных проверок')]:
 text(x,235,n,76,GREEN,True);text(x,185,label,24)
text(80,125,'Проверки на локальном Docker-стенде',20)
text(1080,100,'jmhr.vercel.app',31,INK,True)
footer(3);C.save()
