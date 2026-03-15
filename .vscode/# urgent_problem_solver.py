# urgent_problem_solver.py

# List to store submitted problems
problems = []

# Function to generate simple solution based on category
def generate_solution(category, description):
    category = category.lower()
    if category == "tech":
        solutions = ["Restart device", "Check internet", "Clear cache"]
    elif category == "personal":
        solutions = ["Take a deep breath", "Write down thoughts", "Talk to a friend"]
    elif category == "business":
        solutions = ["Prioritize tasks", "Delegate work", "Call manager"]
    elif category == "health":
        solutions = ["Drink water", "Rest", "Apply ice or heat"]
    else:
        solutions = ["Research online", "Seek expert help"]

    # Pick first solution (or random if you want)
    return solutions[0]

# Function to submit a new urgent problem
def submit_problem():
    print("\n--- Submit a New Urgent Problem ---")
    title = input("Title: ")
    category = input("Category (tech, personal, business, health): ")
    description = input("Description: ")

    solution = generate_solution(category, description)

    # Store problem in the list
    problem = {
        "title": title,
        "category": category,
        "description": description,
        "solution": solution
    }
    problems.append(problem)

    print("\nSuggested Solution:", solution)

# Function to view all problems
def view_problems():
    if not problems:
        print("\nNo problems submitted yet.")
        return
    print("\n--- All Submitted Problems ---")
    for idx, problem in enumerate(problems, start=1):
        print(f"\nProblem #{idx}")
        print("Title:", problem["title"])
        print("Category:", problem["category"])
        print("Description:", problem["description"])
        print("Solution:", problem["solution"])

# Main menu loop
def main():
    while True:
        print("\n--- Urgent Problem Solver ---")
        print("1. Submit a new problem")
        print("2. View all problems")
        print("3. Exit")
        choice = input("Choose an option (1-3): ")

        if choice == "1":
            submit_problem()
        elif choice == "2":
            view_problems()
        elif choice == "3":
            print("Goodbye!")
            break
        else:
            print("Invalid choice. Please enter 1, 2, or 3.")

# Run the program
if __name__ == "__main__":
    main()
