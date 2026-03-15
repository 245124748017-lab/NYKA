import requests
res=requests.post('http://localhost:8000/query',json={'prompt':'revenue over time'})
print(res.status_code,res.text)
