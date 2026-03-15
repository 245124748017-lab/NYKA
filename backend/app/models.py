from sqlalchemy import Column, Integer, String, Float, Date
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Sales(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date)
    region = Column(String)
    category = Column(String)
    revenue = Column(Float)
