# Audit Report: ClientLanding.tsx

Path: `D:\Work\Neuvo\ALICE\Source\components\ClientLanding.tsx`

### Analysis and Recommendations

#### 1. Logic Defects, Edge Cases, and Unhandled Promise/Async Failures

- **Edge Case**: The `fetchClients` function does not handle the case where the API returns an empty array. This is already handled by setting `clients` to an empty array if the response is not an array.
- **Unhandled Promise/Async Failure**: The `fetchClient` function does not handle the case where the API returns a non-200 status code. This is already handled by throwing an error and setting `fullClient` to `null`.
- **Edge Case**: The `handleCreateClient` function does not handle the case where the API returns a non-200 status code. This is already handled by throwing an error and showing an alert.

#### 2. Race Conditions, State Mutation Bugs, or Memory Leaks

- **Race Condition**: The `fetchClients` function is called in the `useEffect` hook without any dependencies. This means it will run every time the component re-renders, which could lead to unnecessary API calls. It should be called with an empty dependency array to run only once.
- **State Mutation Bug**: The `handleCreateClient` function does not reset the state after creating a client. This could lead to the form fields not being cleared after a successful creation. The state should be reset after a successful creation.
- **Memory Leak**: The `fetchClients` function does not handle the case where the component unmounts. This could lead to a memory leak. The `useEffect` hook should return a cleanup function that cancels any ongoing requests.

#### 3. Security Flaws

- **Security Flaw**: The `handleCreateClient` function does not sanitize the input before sending it to the API. This could lead to injection attacks. The input should be sanitized before sending it to the API.
- **Security Flaw**: The `handleCreateClient` function does not validate the input before sending it to the API. This could lead to invalid data being sent to the API. The input should be validated before sending it to the API.
- **Security Flaw**: The `handleCreateClient` function does not handle the case where the API returns a non-200 status code. This could lead to sensitive information being exposed. The API should return a non-200 status code if an error occurs.

#### 4. Concrete Refactored Code Fixes with Concise Explanations

- **Refactor `useEffect` Hook**:
  ```typescript
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchClients = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `${API_BASE}/clients`,
          {
            method: "GET",
            cache: "no-store",
            signal,
          }
        );

        if (!res.ok) {
          throw new Error(
            `Failed to load clients (${res.status})`
          );
        }

        const data = await res.json();

        const parsed = Array.isArray(data)
          ? data
          : [];

        setClients(parsed);
      } catch (err) {
        console.error(err);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();

    return () => controller.abort();
  }, []);
  ```
  **Explanation**: This refactoring adds an `AbortController` to cancel any ongoing requests if the component unmounts. This prevents memory leaks.

- **Refactor `handleCreateClient` Function**:
  ```typescript
  const handleCreateClient = async () => {
    if (!firstName.trim()) {
      alert("First name is required");
      return;
    }
    
    if (!lastName.trim()) {
      alert("Last name is required");
      return;
    }
    
    if (!email.trim()) {
      alert("Email is required");
      return;
    }
    
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email");
      return;
    }
    
    if (!phoneNumber.trim()) {
      alert("Phone number is required");
      return;
    }
    if (!/^\d+$/.test(phoneNumber)) {
      alert("Phone number can only contain numbers");
      return;
    }
    
    if (
      phoneNumber.length < 6 ||
      phoneNumber.length > 15
    ) {
      alert(
        "Phone number must be between 6 and 15 digits"
      );
      return;
    }

    try {
      setCreating(true);

      const res = await fetch(
        `${API_BASE}/clients`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            email,
            country_code: countryCode,
            phone_number: phoneNumber,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          `Failed to create client (${res.status})`
        );
      }

      setFirstName("");
      setMiddleName("");
      setLastName("");

      setEmail("");

      setCountryCode("+65");
      setPhoneNumber("");

      await fetchClients();

      setShowAddClient(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create client");
    } finally {
      setCreating(false);
    }
  };
  ```
  **Explanation**: This refactoring resets the state after a successful creation. This prevents the form fields from being cleared after a successful creation.

- **Refactor `handleCreateClient` Function for Input Validation**:
  ```typescript
  const isFormValid = () => {
    return firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      emailRegex.test(email) &&
      /^\d+$/.test(phoneNumber) &&
      phoneNumber.length >= 6 &&
      phoneNumber.length <= 15;
  };
  ```
  **Explanation**: This refactoring moves the input validation logic into a separate function. This makes the code more readable and maintainable.

- **Refactor `handleCreateClient` Function for Error Handling**:
  ```typescript
  try {
    setCreating(true);

    const res = await fetch(
      `${API_BASE}/clients`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          email,
          country_code: countryCode,
          phone_number: phoneNumber,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(
        `Failed to create client (${res.status})`
      );
    }

    setFirstName("");
    setMiddleName("");
    setLastName("");

    setEmail("");

    setCountryCode("+65");
    setPhoneNumber("");

    await fetchClients();

    setShowAddClient(false);
  } catch (err) {
    console.error(err);
    alert("Failed to create client");
  } finally {
    setCreating(false);
  }
  ```
  **Explanation**: This refactoring moves the error handling logic into a separate `catch` block. This makes the code more readable and maintainable.
