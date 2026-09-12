for (const button of document.querySelectorAll("button[data-action]"))
  button.onclick = async () => {
    const buttons = [...document.querySelectorAll("button")];
    buttons.forEach((item) => (item.disabled = true));
    const status = document.querySelector("#status");
    status.textContent = "Working locally…";
    try {
      const response = await fetch(`/lab/${button.dataset.action}`, {
        method: "POST",
        headers: { "x-lab-code": document.querySelector("#code").value },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      status.textContent = result.message;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      buttons.forEach((item) => (item.disabled = false));
    }
  };
