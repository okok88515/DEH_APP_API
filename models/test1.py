from urllib.request import urlopen
from bs4 import BeautifulSoup
import re
import datetime
import random

random.seed(datetime.datetime.now())

def getLinks(articleUrl):
	web_html = urlopen("http://en.wikipedia.org"+ articleUrl)
	bsObj = BeautifulSoup(web_html,"lxml")
	#回傳該網頁底下的所有內部連結
	return bsObj.find("div",{"class" : "bodyContent"}).findAll("a",href = re.compile("^(/wiki/)((?!:).)*$"))

#取得該網頁歷史編輯紀錄是ip位址的ip list
def getHistoryIps(pageUrl):
	#編輯紀錄頁的網址格式是:http://en.wikipedia.org/w/index.php?title = Title_in_URL&action=history
	pageUrl = pageUrl.replace("/wiki/","")
	historyUrl = "http://en.wikipedia.org/w/index.php?title="+pageUrl+"&action=history"
	print ("historyUrl is : " + historyUrl)
	html = urlopen(historyUrl)
	bsObj = BeautifulSoup(html,"lxml")
	#只找Class 是 "mw-anonuserlink"的連結，這種裡面是ip位址不是帳號
	ipAddresses = bsObj.findAll("a",{"class":"mw-anonuserlink"})
	addressList = set()
	for ipAddress in ipAddresses:
		addressList.add(ipAddress.get_text())
	#回傳ip Set	
	return addressList	 
links = getLinks("/wiki/Python_(programming_language)")

#當此網頁有內部連結時
while(len(links) > 0 ):
	for link in links :
		print ("-----------------------------------")
		historyIPs = getHistoryIps(link.attrs['href'])
			for historyIP in historyIPs:
				print ("History Ip : " , historyIP)
	newLink = links[random.randint(0,len(links)-1)]
	links = getLinks(newLink)
				






