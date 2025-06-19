import os
import sys
import json
import chromadb
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize ChromaDB for RAG
CHROMA_DB_PATH = "./chroma_db"
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
knowledge_collection = chroma_client.get_or_create_collection("educational_content")

# Initialize sentence transformer for embeddings
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# RAG Retriever class
class RAGRetriever:
    def __init__(self):
        self.collection = knowledge_collection
        self.embedding_model = embedding_model
    
    def _add_documents(self, documents):
        """Add documents to ChromaDB."""
        for doc in documents:
            try:
                embedding = self.embedding_model.encode(doc["content"]).tolist()
                self.collection.add(
                    documents=[doc["content"]],  
                    metadatas=[{
                        "subject": doc["subject"],
                        "topic": doc["topic"],
                        "grade_level": doc.get("grade_level", "general")
                    }],
                    ids=[doc["id"]],
                    embeddings=[embedding]
                )
                print(f"Added document: {doc['id']}")
            except Exception as e:
                print(f"Error adding document {doc['id']}: {e}")

# Create RAG retriever instance
rag_retriever = RAGRetriever()

# Extended knowledge base for different subjects and grade levels
KNOWLEDGE_BASE = [
    # Mathematics
    {
        "id": "math_quadratic_equations",
        "subject": "mathematics",
        "topic": "quadratic equations",
        "content": "A quadratic equation is in the form ax² + bx + c = 0. To solve: 1) Factor if possible 2) Use quadratic formula: x = (-b ± √(b²-4ac))/2a 3) Complete the square. The discriminant b²-4ac tells us about the nature of roots.",
        "grade_level": "9-10"
    },
    {
        "id": "math_trigonometry_basics",
        "subject": "mathematics", 
        "topic": "trigonometry",
        "content": "Basic trigonometric ratios: sin(θ) = opposite/hypotenuse, cos(θ) = adjacent/hypotenuse, tan(θ) = opposite/adjacent. Remember SOHCAHTOA. Common angles: sin(30°)=1/2, cos(30°)=√3/2, sin(45°)=√2/2, sin(60°)=√3/2.",
        "grade_level": "10-12"
    },
    {
        "id": "math_derivatives",
        "subject": "mathematics",
        "topic": "calculus derivatives", 
        "content": "Derivatives measure rate of change. Basic rules: d/dx(x^n) = nx^(n-1), d/dx(e^x) = e^x, d/dx(ln x) = 1/x. Product rule: (uv)' = u'v + uv'. Chain rule: (f(g(x)))' = f'(g(x)) × g'(x).",
        "grade_level": "11-12"
    },
    
    # Physics
    {
        "id": "physics_kinematics",
        "subject": "physics",
        "topic": "kinematics",
        "content": "Kinematic equations for constant acceleration: v = u + at, s = ut + ½at², v² = u² + 2as, s = (u+v)t/2. Where u=initial velocity, v=final velocity, a=acceleration, t=time, s=displacement.",
        "grade_level": "9-11"
    },
    {
        "id": "physics_electricity",
        "subject": "physics",
        "topic": "electricity",
        "content": "Ohm's Law: V = IR (Voltage = Current × Resistance). Power: P = VI = I²R = V²/R. In series circuits: total resistance = sum of individual resistances. In parallel: 1/R_total = 1/R₁ + 1/R₂ + ...",
        "grade_level": "10-12"
    },
    {
        "id": "physics_waves",
        "subject": "physics",
        "topic": "waves",
        "content": "Wave equation: v = fλ (velocity = frequency × wavelength). Wave types: mechanical (need medium) and electromagnetic (don't need medium). Properties: amplitude, wavelength, frequency, period. Sound travels ~343 m/s in air.",
        "grade_level": "9-12"
    },
    
    # Chemistry
    {
        "id": "chemistry_atomic_structure",
        "subject": "chemistry",
        "topic": "atomic structure",
        "content": "Atoms have protons (+), neutrons (neutral) in nucleus, electrons (-) in shells. Atomic number = number of protons. Mass number = protons + neutrons. Electron configuration follows: s, p, d, f orbitals. Maximum electrons: s=2, p=6, d=10, f=14.",
        "grade_level": "9-11"
    },
    {
        "id": "chemistry_chemical_bonding",
        "subject": "chemistry",
        "topic": "chemical bonding",
        "content": "Ionic bonds: transfer of electrons (metal + nonmetal). Covalent bonds: sharing electrons (nonmetal + nonmetal). Metallic bonds: electron sea model. Bond strength: ionic > covalent > metallic generally. Electronegativity difference determines bond type.",
        "grade_level": "10-12"
    },
    {
        "id": "chemistry_stoichiometry",
        "subject": "chemistry",
        "topic": "stoichiometry",
        "content": "Stoichiometry uses mole ratios from balanced equations. Steps: 1) Balance equation 2) Convert to moles 3) Use mole ratio 4) Convert to desired units. 1 mole = 6.022×10²³ particles = 22.4L gas at STP = molar mass in grams.",
        "grade_level": "10-12"
    },
    
    # Biology
    {
        "id": "biology_cell_structure",
        "subject": "biology",
        "topic": "cell structure",
        "content": "Cell theory: all living things are made of cells, cells are basic unit of life, all cells come from pre-existing cells. Prokaryotes (no nucleus): bacteria. Eukaryotes (nucleus): plants, animals, fungi. Organelles: mitochondria (energy), ribosomes (protein synthesis), ER (transport).",
        "grade_level": "9-10"
    },
    {
        "id": "biology_photosynthesis",
        "subject": "biology",
        "topic": "photosynthesis",
        "content": "Photosynthesis: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂. Light reactions (thylakoids): capture light, split water, produce ATP and NADPH. Dark reactions/Calvin cycle (stroma): fix CO₂ into glucose using ATP and NADPH.",
        "grade_level": "9-11"
    },
    {
        "id": "biology_genetics",
        "subject": "biology",
        "topic": "genetics",
        "content": "DNA structure: double helix, A-T and G-C base pairs. Gene expression: DNA → RNA → Protein. Mendel's laws: segregation and independent assortment. Punnett squares predict offspring ratios. Dominant alleles mask recessive alleles.",
        "grade_level": "10-12"
    }
]

def initialize_knowledge_base():
    """Initialize the knowledge base with educational content."""
    print("Initializing knowledge base...")
    
    try:
        # Add all documents to RAG retriever
        rag_retriever._add_documents(KNOWLEDGE_BASE)
        print(f"Successfully added {len(KNOWLEDGE_BASE)} documents to knowledge base")
        
        # Verify by checking collection count
        count = rag_retriever.collection.count()
        print(f"Total documents in collection: {count}")
        
    except Exception as e:
        print(f"Error initializing knowledge base: {e}")

if __name__ == "__main__":
    initialize_knowledge_base()
